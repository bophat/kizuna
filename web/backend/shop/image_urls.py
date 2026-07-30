from typing import Any


REMOTE_IMAGE_SCHEMES = ('https://', 'http://')


def resolve_image_url(image: Any, request=None) -> str | None:
    """Return a usable URL for uploaded files and legacy remote ImageField values."""
    if not image:
        return None

    name = str(getattr(image, 'name', '') or '')
    if name.startswith(REMOTE_IMAGE_SCHEMES):
        return name

    try:
        url = image.url
    except (AttributeError, ValueError):
        return None

    if request:
        return request.build_absolute_uri(url)
    return url


def resolve_product_image_url(product: Any, request=None) -> str | None:
    """Prefer the product image, then fall back to its remote source image."""
    product_image = resolve_image_url(getattr(product, 'image', None), request)
    if product_image:
        return product_image

    source = getattr(product, 'source_info', None)
    external_image_url = getattr(source, 'external_image_url', None)
    return str(external_image_url) if external_image_url else None
