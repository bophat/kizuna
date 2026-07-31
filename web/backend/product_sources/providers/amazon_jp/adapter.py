from __future__ import annotations

from product_sources.enums import SourceProvider
from product_sources.providers.amazon_jp.client import AmazonCreatorsApiClient
from product_sources.providers.amazon_jp.mapper import map_amazon_item
from product_sources.providers.amazon_jp.url_parser import (
    canonicalize_amazon_url,
    extract_amazon_asin,
    supports_amazon_url,
)
from product_sources.providers.base import ProductProvider
from product_sources.schemas.provider_product import ProviderProduct


class AmazonJpProvider(ProductProvider):
    provider_code = SourceProvider.AMAZON_JP

    def __init__(self, *, client: AmazonCreatorsApiClient | None = None):
        self.client = client or AmazonCreatorsApiClient()

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
        item = self.client.get_item(source_product_id)
        return map_amazon_item(
            item,
            source_product_id=source_product_id,
            canonical_url=canonical_url,
        )
