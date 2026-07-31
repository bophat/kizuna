from __future__ import annotations

from product_sources.enums import SourceProvider
from product_sources.providers.base import ProductProvider
from product_sources.providers.qoo10_jp.client import Qoo10ApiClient
from product_sources.providers.qoo10_jp.mapper import map_qoo10_item
from product_sources.providers.qoo10_jp.url_parser import (
    canonicalize_qoo10_url,
    extract_qoo10_item_code,
    supports_qoo10_url,
)
from product_sources.schemas.provider_product import ProviderProduct


class Qoo10JpProvider(ProductProvider):
    provider_code = SourceProvider.QOO10_JP

    def __init__(self, *, client: Qoo10ApiClient | None = None):
        self.client = client or Qoo10ApiClient()

    def supports_url(self, url: str) -> bool:
        return supports_qoo10_url(url)

    def canonicalize_url(self, url: str) -> str:
        return canonicalize_qoo10_url(url)

    def extract_source_product_id(self, url: str) -> str:
        return extract_qoo10_item_code(url)

    def get_product(
        self,
        source_product_id: str,
        *,
        canonical_url: str | None = None,
    ) -> ProviderProduct:
        canonical_url = canonical_url or f'https://www.qoo10.jp/item/{source_product_id}'
        item = self.client.get_item(source_product_id)
        return map_qoo10_item(
            item,
            source_product_id=source_product_id,
            canonical_url=canonical_url,
        )
