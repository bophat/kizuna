from product_sources.enums import SourceProvider


PROVIDER_LABELS = {
    SourceProvider.AMAZON_JP: 'Amazon Japan',
    SourceProvider.QOO10_JP: 'Qoo10 Japan',
    SourceProvider.MANUAL: 'Manual',
}


def generate_product_id(provider: str, source_product_id: str) -> str:
    if provider == SourceProvider.AMAZON_JP:
        return f'AMZ-{source_product_id}'
    if provider == SourceProvider.QOO10_JP:
        code = source_product_id
        if not code.startswith('QOO-'):
            return f'QOO-{code}'
        return code
    return source_product_id


def provider_location(provider: str) -> str:
    return PROVIDER_LABELS.get(provider, provider)
