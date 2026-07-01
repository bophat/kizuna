"""httpOnly cookie helpers for JWT auth."""

from django.conf import settings

ACCESS_COOKIE = 'kizuna_access'
REFRESH_COOKIE = 'kizuna_refresh'
COOKIE_PATH = '/api'


def _cookie_kwargs(max_age: int) -> dict:
    secure = not settings.DEBUG
    return {
        'httponly': True,
        'secure': secure,
        'samesite': 'None' if secure else 'Lax',
        'max_age': max_age,
        'path': COOKIE_PATH,
    }


def set_auth_cookies(response, access: str, refresh: str) -> None:
    access_lifetime = int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds())
    refresh_lifetime = int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds())
    response.set_cookie(ACCESS_COOKIE, access, **_cookie_kwargs(access_lifetime))
    response.set_cookie(REFRESH_COOKIE, refresh, **_cookie_kwargs(refresh_lifetime))


def clear_auth_cookies(response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path=COOKIE_PATH)
    response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH)
