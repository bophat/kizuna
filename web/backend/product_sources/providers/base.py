from abc import ABC, abstractmethod

from product_sources.schemas.provider_product import ProviderProduct


class ProductProvider(ABC):
    provider_code: str

    @abstractmethod
    def supports_url(self, url: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def canonicalize_url(self, url: str) -> str:
        raise NotImplementedError

    @abstractmethod
    def extract_source_product_id(self, url: str) -> str:
        raise NotImplementedError

    @abstractmethod
    def get_product(self, source_product_id: str, *, canonical_url: str | None = None) -> ProviderProduct:
        raise NotImplementedError
