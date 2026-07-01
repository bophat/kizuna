import os
import secrets

import requests
from django.conf import settings
from django.core.cache import cache
from django.http import StreamingHttpResponse


def _chat_service_url() -> str:
    from .models import Setting

    try:
        url = Setting.objects.get(key='chatbot_service_url').value.strip()
        if url:
            return url.rstrip('/')
    except Setting.DoesNotExist:
        pass
    return os.environ.get('CHATBOT_SERVICE_URL', 'http://127.0.0.1:8080').rstrip('/')


def _bot_token() -> str:
    return os.environ.get('CHATBOT_INTERNAL_TOKEN', '')


def forward_to_chatbot(method: str, path: str, **kwargs):
    token = _bot_token()
    if not token:
        raise RuntimeError('CHATBOT_INTERNAL_TOKEN is not configured')
    url = f'{_chat_service_url()}{path}'
    headers = kwargs.pop('headers', {})
    headers['X-Bot-Token'] = token
    return requests.request(method, url, headers=headers, timeout=kwargs.pop('timeout', 30), **kwargs)


def create_sse_ticket(user_id: int) -> str:
    ticket = secrets.token_urlsafe(32)
    cache.set(f'chat_sse:{ticket}', user_id, timeout=60)
    return ticket


def validate_sse_ticket(ticket: str) -> bool:
    if not ticket:
        return False
    key = f'chat_sse:{ticket}'
    user_id = cache.get(key)
    if user_id is None:
        return False
    cache.delete(key)
    return True


def stream_chatbot_notifications():
    token = _bot_token()
    url = f'{_chat_service_url()}/api/notifications/stream'
    with requests.get(
        url,
        headers={'X-Bot-Token': token},
        stream=True,
        timeout=120,
    ) as response:
        response.raise_for_status()
        for chunk in response.iter_content(chunk_size=None):
            if chunk:
                yield chunk


def notify_order_placed(order_id, total_amount):
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
    token = _bot_token()
    url = f'{_chat_service_url()}/api/internal/chat/{session_id}/stream'
    with requests.get(
        url,
        headers={'X-Bot-Token': token},
        stream=True,
        timeout=120,
    ) as response:
        response.raise_for_status()
        for chunk in response.iter_content(chunk_size=None):
            if chunk:
                yield chunk
