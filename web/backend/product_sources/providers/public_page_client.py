from __future__ import annotations

import html
import json
import re
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
from typing import Any, Callable
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from product_sources.enums import SourceProvider
from product_sources.exceptions import (
    ProductNotFoundError,
    ProviderPermissionError,
    ProviderRateLimitError,
    ProviderTemporaryError,
)
from product_sources.schemas.provider_product import ProviderImage, ProviderProduct
from product_sources.services.compliance_service import (
    get_allowed_image_hosts,
    get_allowed_source_hosts,
    validate_external_url,
)


_REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})
_VOID_TAGS = frozenset({
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
})
_TARGET_IDS = frozenset({
    'availability',
    'bylineInfo',
    'feature-bullets',
    'item_name',
    'item_price',
    'itemTitle',
    'landingImage',
    'productTitle',
    'sale_price',
    'sellerName',
})
_TARGET_CLASSES = frozenset({
    'a-price-whole',
    'apex-pricetopay-accessibility-label',
    'primary-availability-message',
})
_SPACE_RE = re.compile(r'\s+')
_CHARSET_RE = re.compile(r'charset\s*=\s*["\']?([\w.-]+)', re.IGNORECASE)
_YEN_PRICE_RE = re.compile(r'[¥￥]\s*([\d０-９][\d０-９,，]*(?:[.．]\d+)?)')
_NUMBER_RE = re.compile(r'([\d０-９][\d０-９,，]*(?:[.．]\d+)?)')
_FULL_WIDTH_TRANSLATION = str.maketrans('０１２３４５６７８９，．', '0123456789,.')
_HTML_TAG_RE = re.compile(r'<[^>]+>')


def _clean_text(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = _SPACE_RE.sub(' ', html.unescape(str(value))).strip()
    return cleaned or None


def _decimal_value(value: Any) -> Decimal | None:
    cleaned = _clean_text(value)
    if not cleaned:
        return None
    cleaned = cleaned.translate(_FULL_WIDTH_TRANSLATION)
    match = _YEN_PRICE_RE.search(cleaned) or _NUMBER_RE.search(cleaned)
    if not match:
        return None
    try:
        amount = Decimal(match.group(1).replace(',', ''))
    except InvalidOperation:
        return None
    return amount if amount >= 0 else None


def _element_text(document: str, element_id: str) -> str | None:
    escaped_id = re.escape(element_id)
    match = re.search(
        rf'<(?P<tag>[A-Za-z0-9]+)\b[^>]*\bid\s*=\s*["\']{escaped_id}["\'][^>]*>'
        rf'(?P<body>.*?)</(?P=tag)\s*>',
        document,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return None
    return _clean_text(_HTML_TAG_RE.sub(' ', match.group('body')))


def _class_text(document: str, class_name: str) -> str | None:
    escaped_class = re.escape(class_name)
    match = re.search(
        rf'<(?P<tag>[A-Za-z0-9]+)\b[^>]*\bclass\s*=\s*["\']'
        rf'[^"\']*{escaped_class}[^"\']*["\'][^>]*>'
        rf'(?P<body>.*?)</(?P=tag)\s*>',
        document,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return None
    return _clean_text(_HTML_TAG_RE.sub(' ', match.group('body')))


def _json_ld_product(value: Any) -> dict[str, Any] | None:
    if isinstance(value, list):
        for item in value:
            result = _json_ld_product(item)
            if result is not None:
                return result
        return None
    if not isinstance(value, dict):
        return None

    type_value = value.get('@type')
    types = type_value if isinstance(type_value, list) else [type_value]
    if any(str(item).lower() == 'product' for item in types):
        return value

    for child in value.values():
        result = _json_ld_product(child)
        if result is not None:
            return result
    return None


def _first_mapping(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, list):
        return next((item for item in value if isinstance(item, dict)), {})
    return {}


def _json_ld_image_urls(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        candidate = value.get('url') or value.get('contentUrl')
        return [candidate] if isinstance(candidate, str) else []
    if isinstance(value, list):
        result: list[str] = []
        for item in value:
            result.extend(_json_ld_image_urls(item))
        return result
    return []


class _ProductPageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta: dict[str, list[str]] = defaultdict(list)
        self.element_chunks: dict[str, list[str]] = defaultdict(list)
        self.element_attrs: dict[str, dict[str, str]] = {}
        self.image_candidates: list[str] = []
        self.json_ld_documents: list[Any] = []
        self._stack: list[tuple[str, list[str]]] = []
        self._active_capture_counts: dict[str, int] = defaultdict(int)
        self._captured_characters: dict[str, int] = defaultdict(int)
        self._json_ld_buffer: list[str] | None = None

    def handle_starttag(self, tag: str, attrs_list: list[tuple[str, str | None]]) -> None:
        attrs = {key: value or '' for key, value in attrs_list}
        lower_tag = tag.lower()

        metadata_key = attrs.get('property') or attrs.get('name') or attrs.get('itemprop')
        metadata_content = _clean_text(attrs.get('content'))
        if metadata_key and metadata_content:
            self.meta[metadata_key.strip().lower()].append(metadata_content)

        element_id = attrs.get('id', '')
        if element_id:
            self.element_attrs[element_id] = attrs
        if lower_tag == 'img':
            if element_id == 'landingImage':
                for key in ('data-old-hires', 'src'):
                    if attrs.get(key):
                        self.image_candidates.append(attrs[key])
            elif attrs.get('data-old-hires'):
                self.image_candidates.append(attrs['data-old-hires'])

        capture_keys: list[str] = []
        if element_id in _TARGET_IDS:
            capture_keys.append(element_id)
        classes = set(attrs.get('class', '').split())
        capture_keys.extend(
            f'class:{class_name}'
            for class_name in classes.intersection(_TARGET_CLASSES)
        )
        for key in capture_keys:
            self._active_capture_counts[key] += 1

        if lower_tag == 'script' and 'ld+json' in attrs.get('type', '').lower():
            self._json_ld_buffer = []

        if lower_tag not in _VOID_TAGS:
            self._stack.append((lower_tag, capture_keys))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)

    def handle_data(self, data: str) -> None:
        if self._json_ld_buffer is not None:
            self._json_ld_buffer.append(data)
        cleaned = _clean_text(data)
        if not cleaned:
            return
        for key, count in self._active_capture_counts.items():
            if count > 0:
                remaining = 10_000 - self._captured_characters[key]
                if remaining <= 0:
                    continue
                captured = cleaned[:remaining]
                self.element_chunks[key].append(captured)
                self._captured_characters[key] += len(captured)

    def handle_endtag(self, tag: str) -> None:
        lower_tag = tag.lower()
        if lower_tag == 'script' and self._json_ld_buffer is not None:
            payload = ''.join(self._json_ld_buffer).strip()
            self._json_ld_buffer = None
            if payload:
                try:
                    self.json_ld_documents.append(json.loads(payload))
                except (TypeError, ValueError):
                    pass

        popped: list[tuple[str, list[str]]] = []
        while self._stack:
            entry = self._stack.pop()
            popped.append(entry)
            if entry[0] == lower_tag:
                break
        for _popped_tag, capture_keys in popped:
            for key in capture_keys:
                self._active_capture_counts[key] = max(
                    0,
                    self._active_capture_counts[key] - 1,
                )

    def text(self, key: str) -> str | None:
        return _clean_text(' '.join(self.element_chunks.get(key, [])))

    def first_meta(self, *keys: str) -> str | None:
        for key in keys:
            values = self.meta.get(key.lower(), [])
            if values:
                return values[0]
        return None


class PublicPageProductClient:
    """Read product metadata from public HTML without login or anti-bot bypass."""

    def __init__(
        self,
        *,
        http_client: httpx.Client | None = None,
        url_validator: Callable[..., None] = validate_external_url,
    ):
        self._client = http_client
        self._url_validator = url_validator

    def get_product(
        self,
        provider: str,
        source_product_id: str,
        *,
        canonical_url: str,
    ) -> ProviderProduct:
        cache_key = (
            f'product_sources:public_page:{provider}:{source_product_id}'
        )
        cached = cache.get(cache_key)
        if isinstance(cached, dict):
            return ProviderProduct.model_validate(cached)

        page_url, document = self._fetch_provider_page(
            provider,
            source_product_id,
            canonical_url=canonical_url,
        )
        product = self._extract(
            provider,
            source_product_id,
            canonical_url=canonical_url,
            page_url=page_url,
            document=document,
        )
        cache.set(
            cache_key,
            product.model_dump(mode='json'),
            timeout=max(
                1,
                int(getattr(settings, 'SOURCE_IMPORT_PUBLIC_PAGE_CACHE_SECONDS', 900)),
            ),
        )
        return product

    def _fetch_provider_page(
        self,
        provider: str,
        source_product_id: str,
        *,
        canonical_url: str,
    ) -> tuple[str, str]:
        candidates = [canonical_url]
        if provider == SourceProvider.QOO10_JP:
            candidates.append(
                'https://m.qoo10.jp/gmkt.inc/Mobile/Goods/'
                f'Goods.aspx?goodscode={source_product_id}',
            )

        last_error: Exception | None = None
        for candidate in candidates:
            try:
                document = self._fetch(candidate)
                self._raise_if_blocked(document, provider=provider)
                return candidate, document
            except ProviderPermissionError as exc:
                last_error = exc
                continue

        if last_error is not None:
            raise last_error
        raise ProviderTemporaryError(
            'Không thể đọc trang sản phẩm công khai.',
            details={'provider': provider, 'source_product_id': source_product_id},
        )

    def _fetch(self, url: str) -> str:
        max_bytes = max(
            1,
            int(getattr(settings, 'SOURCE_IMPORT_PUBLIC_PAGE_MAX_BYTES', 4 * 1024 * 1024)),
        )
        max_redirects = max(
            0,
            int(getattr(settings, 'SOURCE_IMPORT_PUBLIC_PAGE_MAX_REDIRECTS', 3)),
        )
        timeout_seconds = max(
            0.1,
            float(getattr(settings, 'SOURCE_IMPORT_PUBLIC_PAGE_TIMEOUT_SECONDS', 15)),
        )
        client = self._client or httpx.Client(
            timeout=httpx.Timeout(timeout_seconds),
            follow_redirects=False,
        )
        owns_client = self._client is None
        try:
            current_url = url
            redirects = 0
            while True:
                self._url_validator(
                    current_url,
                    allowed_hosts=get_allowed_source_hosts(),
                )
                try:
                    with client.stream(
                        'GET',
                        current_url,
                        headers={
                            'Accept': 'text/html,application/xhtml+xml',
                            'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.5',
                            'User-Agent': (
                                'Mozilla/5.0 (compatible; KizunaProductImporter/1.0; '
                                '+https://kizuna-teal.vercel.app)'
                            ),
                        },
                    ) as response:
                        if response.status_code in _REDIRECT_STATUSES:
                            location = response.headers.get('location')
                            if not location:
                                raise ProviderTemporaryError(
                                    'Trang sản phẩm redirect nhưng thiếu Location.',
                                )
                            if redirects >= max_redirects:
                                raise ProviderTemporaryError(
                                    'Trang sản phẩm vượt quá số redirect cho phép.',
                                    details={'max_redirects': max_redirects},
                                )
                            current_url = urljoin(str(response.url), location)
                            redirects += 1
                            continue

                        self._raise_http_error(response)
                        content_type = response.headers.get('content-type', '').lower()
                        if content_type and not any(
                            value in content_type
                            for value in ('text/html', 'application/xhtml+xml')
                        ):
                            raise ProviderTemporaryError(
                                'Marketplace không trả về trang HTML.',
                                details={'content_type': content_type},
                            )
                        content_length = response.headers.get('content-length')
                        if content_length:
                            try:
                                declared_size = int(content_length)
                            except ValueError:
                                declared_size = None
                            if declared_size is not None and declared_size > max_bytes:
                                raise ProviderTemporaryError(
                                    'Trang sản phẩm vượt quá dung lượng cho phép.',
                                    details={'max_bytes': max_bytes},
                                )

                        chunks: list[bytes] = []
                        received = 0
                        for chunk in response.iter_bytes():
                            received += len(chunk)
                            if received > max_bytes:
                                raise ProviderTemporaryError(
                                    'Trang sản phẩm vượt quá dung lượng cho phép.',
                                    details={'max_bytes': max_bytes},
                                )
                            chunks.append(chunk)
                        content = b''.join(chunks)
                        if not content:
                            raise ProviderTemporaryError(
                                'Trang sản phẩm không có dữ liệu.',
                            )
                        charset_match = _CHARSET_RE.search(content_type)
                        charset = charset_match.group(1) if charset_match else 'utf-8'
                        try:
                            return content.decode(charset, errors='replace')
                        except LookupError:
                            return content.decode('utf-8', errors='replace')
                except (
                    ProductNotFoundError,
                    ProviderPermissionError,
                    ProviderRateLimitError,
                    ProviderTemporaryError,
                ):
                    raise
                except httpx.HTTPError as exc:
                    raise ProviderTemporaryError(
                        'Không thể kết nối trang sản phẩm công khai.',
                        details={'error_type': type(exc).__name__},
                    ) from exc
        finally:
            if owns_client:
                client.close()

    @staticmethod
    def _raise_http_error(response: httpx.Response) -> None:
        details = {'status_code': response.status_code, 'operation': 'public_page'}
        if response.status_code in (401, 403):
            raise ProviderPermissionError(
                'Marketplace không cho máy chủ truy cập trang sản phẩm công khai.',
                details=details,
            )
        if response.status_code == 404:
            raise ProductNotFoundError('Không tìm thấy trang sản phẩm.', details=details)
        if response.status_code == 429:
            raise ProviderRateLimitError(
                'Marketplace đang giới hạn tần suất đọc trang sản phẩm.',
                details=details,
            )
        if response.status_code >= 500:
            raise ProviderTemporaryError(
                'Trang sản phẩm của marketplace đang tạm thời không khả dụng.',
                details=details,
            )
        if response.status_code >= 400:
            raise ProviderTemporaryError(
                'Marketplace trả lỗi khi đọc trang sản phẩm.',
                details=details,
            )

    @staticmethod
    def _raise_if_blocked(document: str, *, provider: str) -> None:
        lowered = document[:300_000].lower()
        blocked_markers = (
            'validatecaptcha',
            'robot check',
            'captcha-delivery.com',
            'section_error_full',
            '523 error',
            'connecting 130.62.',
        )
        if any(marker in lowered for marker in blocked_markers):
            raise ProviderPermissionError(
                'Marketplace đang chặn truy cập tự động hoặc yêu cầu CAPTCHA. '
                'Không thể tự lấy dữ liệu URL này nếu chưa có API key.',
                details={'provider': provider, 'reason': 'public_page_blocked'},
            )

    def _extract(
        self,
        provider: str,
        source_product_id: str,
        *,
        canonical_url: str,
        page_url: str,
        document: str,
    ) -> ProviderProduct:
        parser = _ProductPageParser()
        try:
            parser.feed(document)
        except (AssertionError, ValueError):
            pass

        json_product = next(
            (
                product
                for value in parser.json_ld_documents
                if (product := _json_ld_product(value)) is not None
            ),
            {},
        )
        offers = _first_mapping(json_product.get('offers'))
        brand_data = json_product.get('brand')
        brand = (
            _clean_text(brand_data.get('name'))
            if isinstance(brand_data, dict)
            else _clean_text(brand_data)
        )
        seller_data = offers.get('seller') or json_product.get('seller')
        seller = (
            _clean_text(seller_data.get('name'))
            if isinstance(seller_data, dict)
            else _clean_text(seller_data)
        )

        if provider == SourceProvider.AMAZON_JP:
            name = (
                _element_text(document, 'productTitle')
                or parser.text('productTitle')
                or _clean_text(json_product.get('name'))
                or parser.first_meta('og:title', 'twitter:title')
            )
            brand = self._clean_amazon_brand(
                _element_text(document, 'bylineInfo')
                or parser.text('bylineInfo')
                or brand,
            )
            source_price = (
                _decimal_value(offers.get('price') or offers.get('lowPrice'))
                or _decimal_value(parser.first_meta('product:price:amount'))
                or _decimal_value(
                    _class_text(document, 'apex-pricetopay-accessibility-label')
                    or parser.text('class:apex-pricetopay-accessibility-label'),
                )
                or _decimal_value(
                    _class_text(document, 'a-price-whole')
                    or parser.text('class:a-price-whole'),
                )
            )
            availability_text = (
                _clean_text(offers.get('availability'))
                or _element_text(document, 'availability')
                or _class_text(document, 'primary-availability-message')
                or parser.text('availability')
            )
            facts = self._amazon_facts(document, parser)
            image_values = (
                parser.image_candidates
                + _json_ld_image_urls(json_product.get('image'))
                + parser.meta.get('og:image', [])
            )
        else:
            name = (
                _clean_text(json_product.get('name'))
                or parser.first_meta('og:title', 'twitter:title')
                or parser.text('itemTitle')
                or parser.text('item_name')
                or self._script_string(
                    document,
                    ('ItemTitle', 'itemTitle', 'item_name', 'goods_name'),
                )
            )
            brand = brand or parser.first_meta('product:brand', 'brand')
            source_price = (
                _decimal_value(offers.get('price') or offers.get('lowPrice'))
                or _decimal_value(
                    parser.first_meta(
                        'product:price:amount',
                        'price',
                        'og:price:amount',
                    ),
                )
                or _decimal_value(parser.text('item_price'))
                or _decimal_value(parser.text('sale_price'))
                or _decimal_value(
                    self._script_string(
                        document,
                        ('ItemPrice', 'itemPrice', 'sell_price', 'sale_price'),
                    ),
                )
            )
            availability_text = (
                _clean_text(offers.get('availability'))
                or parser.first_meta('product:availability', 'availability')
            )
            facts = []
            image_values = (
                _json_ld_image_urls(json_product.get('image'))
                + parser.meta.get('og:image', [])
                + parser.meta.get('twitter:image', [])
            )

        if not name or self._is_generic_title(name, provider=provider):
            raise ProviderTemporaryError(
                'Không đọc được tên sản phẩm từ trang công khai.',
                details={
                    'provider': provider,
                    'source_product_id': source_product_id,
                    'reason': 'missing_product_name',
                },
            )
        name = name[:500].rstrip()

        description = (
            _clean_text(json_product.get('description'))
            or parser.first_meta('description', 'og:description')
        )
        if description and description not in facts:
            facts.append(description)

        images = self._images(image_values)
        now = timezone.now()
        source_currency = str(
            offers.get('priceCurrency')
            or parser.first_meta('product:price:currency')
            or 'JPY'
        ).upper()
        if source_price is not None and source_currency != 'JPY':
            raise ProviderTemporaryError(
                'Trang sản phẩm trả giá không phải JPY; đã dừng import để tránh '
                'tính sai giá.',
                details={
                    'provider': provider,
                    'source_product_id': source_product_id,
                    'currency': source_currency,
                },
            )

        return ProviderProduct(
            provider=provider,
            source_product_id=source_product_id,
            canonical_url=canonical_url,
            name=name,
            brand=brand,
            seller=seller,
            source_category=_clean_text(json_product.get('category')),
            jan_code=self._jan_code(json_product),
            source_price=source_price,
            source_currency=source_currency,
            availability=self._availability(availability_text),
            stock_quantity=None,
            weight_kg=None,
            description_facts=facts[:10],
            images=images,
            fetched_at=now,
            expires_at=now + timedelta(minutes=15),
            raw_data={
                'source_method': 'public_page',
                'page_url': page_url,
                'detected': {
                    'has_json_ld': bool(json_product),
                    'has_price': source_price is not None,
                    'image_count': len(images),
                },
            },
        )

    @staticmethod
    def _clean_amazon_brand(value: str | None) -> str | None:
        cleaned = _clean_text(value)
        if not cleaned:
            return None
        cleaned = re.sub(r'のストアを表示$', '', cleaned).strip()
        cleaned = re.sub(r'^ブランド\s*[:：]\s*', '', cleaned).strip()
        return cleaned or None

    @staticmethod
    def _amazon_facts(
        document: str,
        parser: _ProductPageParser,
    ) -> list[str]:
        ignored = {'この商品について', 'この商品'}
        result: list[str] = []
        feature_match = re.search(
            r'\bid\s*=\s*["\']feature-bullets["\'][^>]*>.*?'
            r'<ul\b[^>]*>(?P<body>.*?)</ul\s*>',
            document,
            flags=re.IGNORECASE | re.DOTALL,
        )
        values: list[str] = []
        if feature_match:
            values = [
                _HTML_TAG_RE.sub(' ', match)
                for match in re.findall(
                    r'<li\b[^>]*>(.*?)</li\s*>',
                    feature_match.group('body'),
                    flags=re.IGNORECASE | re.DOTALL,
                )
            ]
        if not values:
            values = parser.element_chunks.get('feature-bullets', [])
        for value in values:
            cleaned = _clean_text(value)
            if not cleaned or cleaned in ignored or len(cleaned) < 8:
                continue
            if cleaned not in result:
                result.append(cleaned)
        return result[:10]

    @staticmethod
    def _availability(value: str | None) -> str:
        cleaned = (_clean_text(value) or '').lower()
        if any(
            marker in cleaned
            for marker in (
                'outofstock',
                'out_of_stock',
                'discontinued',
                'soldout',
                'sold_out',
                '在庫切れ',
                '現在お取り扱いしておりません',
                '販売終了',
            )
        ):
            return 'unavailable'
        if any(
            marker in cleaned
            for marker in (
                'instock',
                'in_stock',
                'limitedavailability',
                'preorder',
                '在庫あり',
                '販売中',
            )
        ):
            return 'available'
        return 'unknown'

    @staticmethod
    def _jan_code(product: dict[str, Any]) -> str | None:
        for key in ('gtin13', 'gtin12', 'gtin14', 'gtin', 'sku'):
            value = _clean_text(product.get(key))
            if value and value.isdigit() and 8 <= len(value) <= 14:
                return value
        return None

    @staticmethod
    def _images(values: list[str]) -> list[ProviderImage]:
        allowed_hosts = get_allowed_image_hosts()
        seen: set[str] = set()
        result: list[ProviderImage] = []
        for value in values:
            cleaned = _clean_text(value)
            if not cleaned:
                continue
            parsed = urlsplit(cleaned)
            host = (parsed.hostname or '').lower()
            if parsed.scheme == 'http' and host in allowed_hosts:
                cleaned = urlunsplit(('https', parsed.netloc, parsed.path, parsed.query, ''))
                parsed = urlsplit(cleaned)
            if parsed.scheme != 'https' or host not in allowed_hosts:
                continue
            if cleaned in seen:
                continue
            seen.add(cleaned)
            result.append(
                ProviderImage(
                    url=cleaned,
                    is_primary=not result,
                    sort_order=len(result),
                ),
            )
            if len(result) >= 10:
                break
        return result

    @staticmethod
    def _script_string(document: str, keys: tuple[str, ...]) -> str | None:
        escaped_keys = '|'.join(re.escape(key) for key in keys)
        pattern = re.compile(
            rf'(?:"|\')?(?:{escaped_keys})(?:"|\')?\s*[:=]\s*'
            r'(?:"([^"]{1,1000})"|\'([^\']{1,1000})\'|([0-9][0-9,.]*))',
            re.IGNORECASE,
        )
        match = pattern.search(document)
        if not match:
            return None
        value = next((group for group in match.groups() if group is not None), None)
        if value is None:
            return None
        try:
            return json.loads(f'"{value}"')
        except (TypeError, ValueError):
            return _clean_text(value)

    @staticmethod
    def _is_generic_title(name: str, *, provider: str) -> bool:
        lowered = _SPACE_RE.sub(' ', name).strip().lower()
        generic = {
            SourceProvider.AMAZON_JP: {'amazon.co.jp', 'amazon.co.jp: 通販'},
            SourceProvider.QOO10_JP: {
                'qoo10',
                'qoo10 - ネット通販｜ebay japan',
                'qoo10 - ネット通販 | ebay japan',
            },
        }
        return lowered in generic.get(provider, set())
