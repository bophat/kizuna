"""Bridge between Flask chatbot and Django admin API."""

import os
import json
import requests

DJANGO_API_URL = os.getenv('DJANGO_API_URL', 'http://127.0.0.1:8000/api').rstrip('/')
BOT_TOKEN = os.getenv('CHATBOT_INTERNAL_TOKEN', '')


def _headers():
    return {
        'X-Bot-Token': BOT_TOKEN,
        'Content-Type': 'application/json',
    }


def fetch_product_catalog():
    """Load product KB from Django DB."""
    if not BOT_TOKEN:
        return None
    try:
        res = requests.get(
            f'{DJANGO_API_URL}/admin/bot/products/',
            headers=_headers(),
            timeout=15,
        )
        if res.status_code == 200:
            return res.json()
    except Exception as exc:
        print(f'[django_bridge] fetch products: {exc}')
    return None


def fetch_bot_config():
    if not BOT_TOKEN:
        return {}
    try:
        res = requests.get(
            f'{DJANGO_API_URL}/admin/bot/config/',
            headers=_headers(),
            timeout=15,
        )
        if res.status_code == 200:
            return res.json()
    except Exception as exc:
        print(f'[django_bridge] fetch config: {exc}')
    return {}


def create_pending_reply(
    channel,
    customer_id,
    incoming_message,
    draft_reply,
    is_greeting=False,
    customer_name='',
    metadata=None,
):
    if not BOT_TOKEN:
        print('[django_bridge] No CHATBOT_INTERNAL_TOKEN — cannot queue reply')
        return None
    payload = {
        'channel': channel,
        'customer_id': customer_id,
        'customer_name': customer_name,
        'incoming_message': incoming_message,
        'draft_reply': draft_reply,
        'is_greeting': is_greeting,
        'metadata': metadata or {},
    }
    try:
        res = requests.post(
            f'{DJANGO_API_URL}/admin/bot/pending-replies/',
            headers=_headers(),
            json=payload,
            timeout=15,
        )
        if res.status_code in (200, 201):
            return res.json()
        print(f'[django_bridge] create pending failed: {res.status_code} {res.text[:200]}')
    except Exception as exc:
        print(f'[django_bridge] create pending: {exc}')
    return None


def log_repost(source_post_id, group_id, message_preview, status='success', error_message=''):
    if not BOT_TOKEN:
        return
    try:
        from admin_api.models import RepostLog  # noqa — only when running inside Django
    except ImportError:
        pass
    try:
        requests.post(
            f'{DJANGO_API_URL}/admin/bot/repost-log/',
            headers=_headers(),
            json={
                'source_post_id': source_post_id,
                'group_id': group_id,
                'message_preview': message_preview[:500],
                'status': status,
                'error_message': error_message,
            },
            timeout=10,
        )
    except Exception:
        pass
