"""CORS helpers for plain Django SSE views (corsheaders may not attach to stream errors)."""

from django.conf import settings
from django.http import HttpResponse


def _allowed_origin(request) -> str | None:
    origin = request.META.get('HTTP_ORIGIN', '').strip()
    if not origin:
        return None
    if getattr(settings, 'CORS_ALLOW_ALL_ORIGINS', False):
        return origin
    allowed = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])
    if origin in allowed:
        return origin
    return None


def apply_sse_cors(response: HttpResponse, request) -> HttpResponse:
    origin = _allowed_origin(request)
    if origin:
        response['Access-Control-Allow-Origin'] = origin
        response['Vary'] = 'Origin'
    if getattr(settings, 'CORS_ALLOW_CREDENTIALS', False):
        response['Access-Control-Allow-Credentials'] = 'true'
    return response


def sse_forbidden(request, message: str = 'Forbidden') -> HttpResponse:
    return apply_sse_cors(HttpResponse(message, status=403), request)
