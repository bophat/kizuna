import json
import logging
from urllib.error import URLError
from urllib.request import urlopen

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)

CACHE_KEY = 'shop:exchange_rates'
DEFAULT_USD_TO_VND = 25_000
DEFAULT_USD_TO_JPY = 150.0
FRANKFURTER_URL = 'https://api.frankfurter.app/latest?from=USD&to=VND,JPY'


def _cache_ttl() -> int:
    return int(getattr(settings, 'EXCHANGE_RATE_CACHE_SECONDS', 3600))


def _fallback_payload() -> dict:
    return {
        'base': 'USD',
        'usd_to_vnd': DEFAULT_USD_TO_VND,
        'usd_to_jpy': DEFAULT_USD_TO_JPY,
        'jpy_to_vnd': round(DEFAULT_USD_TO_VND / DEFAULT_USD_TO_JPY, 2),
        'source': 'fallback',
        'date': None,
        'fetched_at': timezone.now().isoformat(),
        'is_live': False,
    }


def _fetch_live_rates() -> dict:
    url = getattr(settings, 'EXCHANGE_RATE_API_URL', FRANKFURTER_URL)
    from urllib.request import Request
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
    with urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode())
    rates = data.get('rates', {})
    usd_to_vnd = float(rates['VND'])
    usd_to_jpy = float(rates['JPY'])
    if usd_to_vnd <= 0 or usd_to_jpy <= 0:
        raise ValueError('Invalid rates from provider')
    return {
        'base': 'USD',
        'usd_to_vnd': round(usd_to_vnd),
        'usd_to_jpy': round(usd_to_jpy, 4),
        'jpy_to_vnd': round(usd_to_vnd / usd_to_jpy, 2),
        'source': 'frankfurter',
        'date': data.get('date'),
        'fetched_at': timezone.now().isoformat(),
        'is_live': True,
    }


def get_exchange_rates(*, force_refresh: bool = False) -> dict:
    if not force_refresh:
        cached = cache.get(CACHE_KEY)
        if cached:
            return cached

    try:
        payload = _fetch_live_rates()
    except (URLError, TimeoutError, KeyError, ValueError, json.JSONDecodeError) as exc:
        logger.warning('Exchange rate fetch failed: %s', exc)
        payload = _fallback_payload()

    cache.set(CACHE_KEY, payload, _cache_ttl())
    return payload
