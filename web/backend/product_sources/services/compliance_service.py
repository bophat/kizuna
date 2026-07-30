import ipaddress
import socket
from urllib.parse import urlparse

from django.conf import settings

from product_sources.exceptions import SSRFBlockedError

DEFAULT_SOURCE_HOSTS = frozenset({
    'www.amazon.co.jp',
    'amazon.co.jp',
    'www.qoo10.jp',
    'qoo10.jp',
    'm.qoo10.jp',
})

DEFAULT_IMAGE_HOSTS = DEFAULT_SOURCE_HOSTS | frozenset({
    'm.media-amazon.com',
    'images-na.ssl-images-amazon.com',
    'gd.image-gmkt.com',
    'image.qoo10.jp',
})


def get_allowed_image_hosts() -> frozenset[str]:
    extra = getattr(settings, 'SOURCE_IMPORT_ALLOWED_IMAGE_HOSTS', [])
    return DEFAULT_IMAGE_HOSTS | frozenset(extra)


def get_allowed_source_hosts() -> frozenset[str]:
    return DEFAULT_SOURCE_HOSTS


def validate_external_url(url: str, *, allowed_hosts: frozenset[str] | None = None) -> None:
    parsed = urlparse(url.strip())
    if parsed.scheme != 'https':
        raise SSRFBlockedError('Chỉ chấp nhận URL https.', details={'url': url})
    if parsed.username or parsed.password:
        raise SSRFBlockedError('URL không được chứa username/password.', details={'url': url})

    host = (parsed.hostname or '').lower()
    allowed = allowed_hosts or get_allowed_image_hosts()
    if host not in allowed:
        raise SSRFBlockedError(f'Hostname "{host}" không nằm trong whitelist.', details={'url': url})

    _assert_not_private_ip(host)


def _assert_not_private_ip(hostname: str) -> None:
    try:
        for info in socket.getaddrinfo(hostname, None):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                raise SSRFBlockedError(
                    'URL trỏ tới private/reserved IP.',
                    details={'hostname': hostname},
                )
    except socket.gaierror:
        raise SSRFBlockedError('Không thể resolve hostname.', details={'hostname': hostname}) from None
