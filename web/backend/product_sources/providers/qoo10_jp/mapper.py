from __future__ import annotations

import html
import re
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from django.utils import timezone

from product_sources.enums import SourceProvider
from product_sources.exceptions import ProviderTemporaryError
from product_sources.schemas.provider_product import ProviderImage, ProviderProduct


HTML_TAG_RE = re.compile(r'<[^>]+>')
SPACE_RE = re.compile(r'\s+')


def _text(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def _decimal(value: Any) -> Decimal | None:
    cleaned = _text(value)
    if not cleaned:
        return None
    cleaned = cleaned.replace(',', '').replace('¥', '').replace('円', '').strip()
    try:
        amount = Decimal(cleaned)
    except InvalidOperation:
        return None
    return amount if amount >= 0 else None


def _integer(value: Any) -> int | None:
    cleaned = _text(value)
    if not cleaned:
        return None
    try:
        result = int(Decimal(cleaned.replace(',', '')))
    except (InvalidOperation, ValueError):
        return None
    return max(0, result)


def _https_image_url(value: Any) -> str | None:
    image_url = _text(value)
    if not image_url:
        return None
    parsed = urlsplit(image_url)
    if parsed.scheme == 'http' and (
        parsed.hostname == 'qoo10.jp'
        or (parsed.hostname or '').endswith('.qoo10.jp')
        or (parsed.hostname or '').endswith('.image-qoo10.jp')
    ):
        return urlunsplit(('https', parsed.netloc, parsed.path, parsed.query, ''))
    return image_url


def _category(item: dict[str, Any]) -> str | None:
    values: list[str] = []
    for key in ('MainCatNm', 'FirstSubCatNm', 'SecondSubCatNm'):
        value = _text(item.get(key))
        if value and value not in values:
            values.append(value)
    return ' > '.join(values) if values else None


def _brand(item: dict[str, Any]) -> str | None:
    for key in ('BrandNm', 'BrandName', 'ManufacturerNm', 'BrandNo', 'ManufacturerDate'):
        value = _text(item.get(key))
        if not value:
            continue
        if key == 'BrandNo' and value.isdigit():
            continue
        if key == 'ManufacturerDate' and re.fullmatch(r'\d{4}[-/.]\d{1,2}[-/.]\d{1,2}', value):
            continue
        return value[:100]
    return None


def _description_facts(item: dict[str, Any]) -> list[str]:
    detail = _text(item.get('ItemDetail'))
    if not detail:
        return []
    cleaned = SPACE_RE.sub(' ', html.unescape(HTML_TAG_RE.sub(' ', detail))).strip()
    return [cleaned[:500]] if cleaned else []


def map_qoo10_item(
    item: dict[str, Any],
    *,
    source_product_id: str,
    canonical_url: str,
) -> ProviderProduct:
    name = _text(item.get('ItemTitle'))
    if not name:
        raise ProviderTemporaryError(
            'Qoo10 không trả tên sản phẩm.',
            details={'source_product_id': source_product_id},
        )
    source_price = _decimal(item.get('ItemPrice'))
    stock_quantity = _integer(item.get('ItemQty'))
    item_status = (_text(item.get('ItemStatus')) or '').upper()
    if item_status == 'S2' and (stock_quantity is None or stock_quantity > 0):
        availability = 'available'
    elif item_status in {'S1', 'S3', 'S4'} or stock_quantity == 0:
        availability = 'unavailable'
    else:
        availability = 'unknown'

    industrial_type = (_text(item.get('IndustrialCodeType')) or '').upper()
    jan_code = (
        _text(item.get('IndustrialCode'))
        if industrial_type in {'J', 'E', 'U'}
        else None
    )
    image_url = _https_image_url(item.get('ImageUrl'))
    images = [ProviderImage(url=image_url, is_primary=True)] if image_url else []
    now = timezone.now()
    return ProviderProduct(
        provider=SourceProvider.QOO10_JP,
        source_product_id=source_product_id,
        canonical_url=canonical_url,
        name=name,
        brand=_brand(item),
        seller=_text(item.get('SellerCode')),
        source_category=_category(item),
        jan_code=jan_code,
        source_price=source_price,
        source_currency='JPY',
        availability=availability,
        stock_quantity=stock_quantity,
        weight_kg=None,
        description_facts=_description_facts(item),
        images=images,
        fetched_at=now,
        expires_at=now + timedelta(hours=6),
        raw_data={'item': item},
    )
