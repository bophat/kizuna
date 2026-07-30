import re

from product_sources.security import redact_sensitive_data
from product_sources.schemas.provider_product import ProviderImage, ProviderProduct

CONTROL_CHARS = re.compile(r'[\x00-\x1f\x7f]')


def normalize_name(name: str, *, max_length: int = 200) -> str:
    cleaned = CONTROL_CHARS.sub('', name.strip())
    if len(cleaned) > max_length:
        return cleaned[:max_length].rstrip()
    return cleaned


def normalize_brand(brand: str | None) -> str | None:
    if not brand:
        return None
    cleaned = CONTROL_CHARS.sub('', brand.strip())
    return cleaned[:100] if cleaned else None


def normalize_images(images: list[ProviderImage], *, max_count: int = 10) -> list[ProviderImage]:
    seen: set[str] = set()
    result: list[ProviderImage] = []
    for img in sorted(images, key=lambda i: (not i.is_primary, i.sort_order)):
        url = str(img.url)
        if url in seen:
            continue
        seen.add(url)
        result.append(img)
        if len(result) >= max_count:
            break
    return result


def sanitize_raw_data(raw: dict) -> dict:
    return redact_sensitive_data(raw)


def normalize_provider_product(product: ProviderProduct) -> ProviderProduct:
    return product.model_copy(update={
        'name': normalize_name(product.name),
        'brand': normalize_brand(product.brand),
        'images': normalize_images(product.images),
        'raw_data': sanitize_raw_data(product.raw_data),
    })
