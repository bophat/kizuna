import re
from urllib.parse import urlparse

from product_sources.exceptions import InvalidSourceUrlError

AMAZON_HOSTS = frozenset({'www.amazon.co.jp', 'amazon.co.jp'})
ASIN_PATTERN = re.compile(r'^[A-Z0-9]{10}$')


def extract_amazon_asin(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in ('http', 'https'):
        raise InvalidSourceUrlError('URL phải dùng giao thức http hoặc https.', details={'url': url})
    if parsed.netloc.lower() not in AMAZON_HOSTS:
        raise InvalidSourceUrlError('URL không thuộc Amazon Japan.', details={'url': url})

    path = parsed.path or ''
    segments = [s for s in path.split('/') if s]

    for i, seg in enumerate(segments):
        if seg in ('dp', 'gp', 'product') and i + 1 < len(segments):
            candidate = segments[i + 1]
            if candidate == 'product' and i + 2 < len(segments):
                candidate = segments[i + 2]
            if ASIN_PATTERN.match(candidate):
                return candidate

    raise InvalidSourceUrlError(
        'Không thể xác định ASIN từ URL.',
        details={'url': url},
    )


def canonicalize_amazon_url(url: str) -> str:
    asin = extract_amazon_asin(url)
    return f'https://www.amazon.co.jp/dp/{asin}'


def supports_amazon_url(url: str) -> bool:
    try:
        extract_amazon_asin(url)
        return True
    except InvalidSourceUrlError:
        return False
