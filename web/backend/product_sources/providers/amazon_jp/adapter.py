from __future__ import annotations

from django.conf import settings

from product_sources.enums import SourceProvider
from product_sources.providers.amazon_jp.client import AmazonCreatorsApiClient
from product_sources.providers.amazon_jp.mapper import map_amazon_item
from product_sources.providers.amazon_jp.url_parser import (
    canonicalize_amazon_url,
    extract_amazon_asin,
    supports_amazon_url,
)
from product_sources.providers.base import ProductProvider
from product_sources.providers.public_page_client import PublicPageProductClient
from product_sources.schemas.provider_product import ProviderProduct


class AmazonJpProvider(ProductProvider):
    provider_code = SourceProvider.AMAZON_JP

    def __init__(
        self,
        *,
        client: AmazonCreatorsApiClient | None = None,
        public_page_client: PublicPageProductClient | None = None,
    ):
        self.client = client or AmazonCreatorsApiClient()
        self.public_page_client = public_page_client or PublicPageProductClient()

    def supports_url(self, url: str) -> bool:
        return supports_amazon_url(url)

    def canonicalize_url(self, url: str) -> str:
        return canonicalize_amazon_url(url)

    def extract_source_product_id(self, url: str) -> str:
        return extract_amazon_asin(url)

    def get_product(
        self,
        source_product_id: str,
        *,
        canonical_url: str | None = None,
    ) -> ProviderProduct:
        canonical_url = canonical_url or f'https://www.amazon.co.jp/dp/{source_product_id}'
        if (
            not self.client.has_any_credentials()
            and getattr(settings, 'SOURCE_IMPORT_PUBLIC_PAGE_FALLBACK_ENABLED', True)
        ):
            return self.public_page_client.get_product(
                self.provider_code,
                source_product_id,
                canonical_url=canonical_url,
            )
        item = self.client.get_item(source_product_id)
        return map_amazon_item(
            item,
            source_product_id=source_product_id,
            canonical_url=canonical_url,
        )
