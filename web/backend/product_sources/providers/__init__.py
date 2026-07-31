from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.utils import timezone as django_tz

from product_sources.enums import SourceProvider
from product_sources.exceptions import ProductNotFoundError
from product_sources.providers.amazon_jp.adapter import AmazonJpProvider
from product_sources.providers.amazon_jp.url_parser import (
    canonicalize_amazon_url,
    extract_amazon_asin,
    supports_amazon_url,
)
from product_sources.providers.base import ProductProvider
from product_sources.providers.qoo10_jp.adapter import Qoo10JpProvider
from product_sources.providers.registry import ProviderRegistry
from product_sources.providers.qoo10_jp.url_parser import (
    canonicalize_qoo10_url,
    extract_qoo10_item_code,
    supports_qoo10_url,
)
from product_sources.schemas.provider_product import ProviderImage, ProviderProduct


class FakeAmazonJpProvider(ProductProvider):
    """Mock provider for dev/test — returns deterministic fixture data."""

    provider_code = SourceProvider.AMAZON_JP

    def supports_url(self, url: str) -> bool:
        return supports_amazon_url(url)

    def canonicalize_url(self, url: str) -> str:
        return canonicalize_amazon_url(url)

    def extract_source_product_id(self, url: str) -> str:
        return extract_amazon_asin(url)

    def get_product(self, source_product_id: str, *, canonical_url: str | None = None) -> ProviderProduct:
        if source_product_id == 'NOTFOUND000':
            raise ProductNotFoundError('Không tìm thấy sản phẩm.', details={'source_product_id': source_product_id})

        now = django_tz.now()
        url = canonical_url or f'https://www.amazon.co.jp/dp/{source_product_id}'
        return ProviderProduct(
            provider=self.provider_code,
            source_product_id=source_product_id,
            canonical_url=url,
            name=f'[Fake Amazon] Sample Product {source_product_id}',
            brand='Sample Brand',
            source_category='Beauty > Skincare',
            source_price=Decimal('3980'),
            availability='available',
            stock_quantity=10,
            weight_kg=Decimal('0.30'),
            description_facts=['Sample fact 1', 'Sample fact 2'],
            images=[
                ProviderImage(url='https://m.media-amazon.com/images/I/sample.jpg', is_primary=True),
            ],
            fetched_at=now,
            expires_at=now + timedelta(hours=6),
            raw_data={'fixture': True, 'asin': source_product_id},
        )


class FakeQoo10JpProvider(ProductProvider):
    provider_code = SourceProvider.QOO10_JP

    def supports_url(self, url: str) -> bool:
        return supports_qoo10_url(url)

    def canonicalize_url(self, url: str) -> str:
        return canonicalize_qoo10_url(url)

    def extract_source_product_id(self, url: str) -> str:
        return extract_qoo10_item_code(url)

    def get_product(self, source_product_id: str, *, canonical_url: str | None = None) -> ProviderProduct:
        if source_product_id == '000000000':
            raise ProductNotFoundError('Không tìm thấy sản phẩm.', details={'source_product_id': source_product_id})

        now = django_tz.now()
        url = canonical_url or f'https://www.qoo10.jp/item/{source_product_id}'
        return ProviderProduct(
            provider=self.provider_code,
            source_product_id=source_product_id,
            canonical_url=url,
            name=f'[Fake Qoo10] Sample Item {source_product_id}',
            brand='Qoo10 Seller',
            seller='Sample Seller',
            source_category='Cosmetics',
            source_price=Decimal('2480'),
            availability='available',
            stock_quantity=5,
            weight_kg=None,
            description_facts=['Qoo10 sample detail'],
            images=[
                ProviderImage(url='https://gd.image-gmkt.com/sample.jpg', is_primary=True),
            ],
            fetched_at=now,
            expires_at=now + timedelta(hours=6),
            raw_data={'fixture': True, 'item_code': source_product_id},
        )


def build_provider_registry(*, use_fake: bool | None = None) -> ProviderRegistry:
    if use_fake is None:
        use_fake = getattr(settings, 'SOURCE_IMPORT_USE_FAKE_PROVIDERS', settings.DEBUG)

    registry = ProviderRegistry()
    if use_fake:
        registry.register(FakeAmazonJpProvider())
        registry.register(FakeQoo10JpProvider())
    else:
        registry.register(AmazonJpProvider())
        registry.register(Qoo10JpProvider())
    return registry
