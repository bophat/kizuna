from urllib.parse import parse_qs, urlparse

from product_sources.exceptions import InvalidSourceUrlError

QOO10_HOSTS = frozenset({'www.qoo10.jp', 'qoo10.jp', 'm.qoo10.jp'})


def extract_qoo10_item_code(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in ('http', 'https'):
        raise InvalidSourceUrlError('URL phải dùng giao thức http hoặc https.', details={'url': url})
    if parsed.netloc.lower() not in QOO10_HOSTS:
        raise InvalidSourceUrlError('URL không thuộc Qoo10 Japan.', details={'url': url})

    query = parse_qs(parsed.query)
    if 'goodscode' in query and query['goodscode'][0].strip():
        return query['goodscode'][0].strip()

    path = parsed.path or ''
    segments = [s for s in path.split('/') if s]
    for i, seg in enumerate(segments):
        if seg.lower() in ('item', 'goods') and i + 1 < len(segments):
            code = segments[i + 1].strip()
            if code.isdigit():
                return code

    if segments and segments[-1].isdigit():
        return segments[-1]

    raise InvalidSourceUrlError(
        'Không thể xác định ItemCode từ URL.',
        details={'url': url},
    )


def canonicalize_qoo10_url(url: str) -> str:
    item_code = extract_qoo10_item_code(url)
    return f'https://www.qoo10.jp/item/{item_code}'


def supports_qoo10_url(url: str) -> bool:
    try:
        extract_qoo10_item_code(url)
        return True
    except InvalidSourceUrlError:
        return False
