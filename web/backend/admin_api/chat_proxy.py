import json
import os

import requests
from django.conf import settings
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.http import StreamingHttpResponse

from .sse_cors import apply_sse_cors

SSE_TICKET_SALT = 'kizuna-chat-sse'
SSE_TICKET_MAX_AGE = 120

_sse_signer = TimestampSigner(salt=SSE_TICKET_SALT)


class ChatbotDisabledError(RuntimeError):
    """Raised when chatbot service is turned off in admin settings."""


def is_chatbot_enabled() -> bool:
    from .models import Setting

    try:
        raw = Setting.objects.get(key='chatbot_enabled').value
    except Setting.DoesNotExist:
        raw = os.environ.get('CHATBOT_ENABLED', 'false')
    return str(raw).strip().lower() in ('1', 'true', 'yes', 'on')


def _chat_service_url() -> str:
    from .models import Setting

    try:
        url = Setting.objects.get(key='chatbot_service_url').value.strip()
        if url:
            return url.rstrip('/')
    except Exception:
        pass
    return os.environ.get('CHATBOT_SERVICE_URL', 'http://127.0.0.1:8080').rstrip('/')


def _bot_token() -> str:
    return os.environ.get('CHATBOT_INTERNAL_TOKEN', '')


def forward_to_chatbot(method: str, path: str, **kwargs):
    if not is_chatbot_enabled():
        raise ChatbotDisabledError('Chatbot service is disabled in admin settings')
    token = _bot_token()
    if not token:
        raise RuntimeError('CHATBOT_INTERNAL_TOKEN is not configured')
    url = f'{_chat_service_url()}{path}'
    headers = kwargs.pop('headers', {})
    headers['X-Bot-Token'] = token
    return requests.request(method, url, headers=headers, timeout=kwargs.pop('timeout', 30), **kwargs)


def create_sse_ticket(user_id: int) -> str:
    """Stateless signed ticket — works across gunicorn workers (no shared cache)."""
    return _sse_signer.sign(str(user_id))


def validate_sse_ticket(ticket: str) -> bool:
    if not ticket:
        return False
    try:
        _sse_signer.unsign(ticket, max_age=SSE_TICKET_MAX_AGE)
        return True
    except (BadSignature, SignatureExpired):
        return False


def _sse_error_event(code: str, message: str):
    payload = json.dumps({'type': 'ERROR', 'code': code, 'message': message})
    yield f'data: {payload}\n\n'.encode('utf-8')


def _iter_upstream_stream(url: str, headers: dict):
    with requests.get(
        url,
        headers=headers,
        stream=True,
        timeout=(8, 300),
    ) as response:
        response.raise_for_status()
        for chunk in response.iter_content(chunk_size=4096):
            if chunk:
                yield chunk


def _is_local_service_url(url: str) -> bool:
    return '127.0.0.1' in url or 'localhost' in url


def stream_chatbot_notifications():
    if not is_chatbot_enabled():
        return

    token = _bot_token()
    if not token:
        yield from _sse_error_event('no_bot_token', 'CHATBOT_INTERNAL_TOKEN is not configured')
        return

    service_url = _chat_service_url()
    # Production cannot reach 127.0.0.1 — skip immediately. Dev may use local Flask.
    if _is_local_service_url(service_url) and not settings.DEBUG:
        yield from _sse_error_event(
            'chatbot_localhost',
            'Chatbot service URL points to localhost — set CHATBOT_SERVICE_URL on the server',
        )
        return

    url = f'{service_url}/api/notifications/stream'
    try:
        yield from _iter_upstream_stream(url, {'X-Bot-Token': token})
    except Exception as exc:
        print(f'[sse] chatbot notifications stream failed: {exc}')
        yield from _sse_error_event('chatbot_unreachable', 'Cannot connect to chatbot service')


def notify_order_placed(order_id, total_amount):
    if not is_chatbot_enabled():
        return
    try:
        forward_to_chatbot(
            'POST',
            '/api/internal/order/new',
            json={'order_id': order_id, 'total': str(total_amount)},
            timeout=10,
        )
    except Exception as exc:
        print(f'[chat_notify] order notification failed: {exc}')


def stream_concierge_session(session_id: str):
    if not is_chatbot_enabled():
        return

    token = _bot_token()
    if not token:
        yield from _sse_error_event('no_bot_token', 'CHATBOT_INTERNAL_TOKEN is not configured')
        return

    service_url = _chat_service_url()
    url = f'{service_url}/api/internal/chat/{session_id}/stream'
    try:
        yield from _iter_upstream_stream(url, {'X-Bot-Token': token})
    except Exception as exc:
        print(f'[sse] concierge stream failed: {exc}')
        yield from _sse_error_event('chatbot_unreachable', 'Cannot connect to chatbot service')


def sse_streaming_response(stream_iter, request=None):
    response = StreamingHttpResponse(stream_iter, content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    if request is not None:
        apply_sse_cors(response, request)
    return response
