from product_sources.exceptions import UnsupportedProviderError
from product_sources.providers.base import ProductProvider


class ProviderRegistry:
    def __init__(self, providers: list[ProductProvider] | None = None):
        self._providers: list[ProductProvider] = providers or []

    def register(self, provider: ProductProvider) -> None:
        self._providers.append(provider)

    @property
    def providers(self) -> list[ProductProvider]:
        return list(self._providers)

    def resolve_by_url(self, url: str) -> ProductProvider:
        for provider in self._providers:
            if provider.supports_url(url):
                return provider
        raise UnsupportedProviderError(
            'URL không thuộc provider được hỗ trợ.',
            details={'url': url},
        )

    def get_by_code(self, code: str) -> ProductProvider:
        for provider in self._providers:
            if provider.provider_code == code:
                return provider
        raise UnsupportedProviderError(
            f'Provider "{code}" chưa được cấu hình.',
            details={'provider': code},
        )
