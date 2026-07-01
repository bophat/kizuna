"""Auth helpers for Flask chatbot service."""

import os
from functools import wraps

from flask import jsonify, request

BOT_INTERNAL_TOKEN = os.getenv('CHATBOT_INTERNAL_TOKEN', '')


def require_bot_token(f):
    """Require X-Bot-Token matching CHATBOT_INTERNAL_TOKEN."""

    @wraps(f)
    def decorated(*args, **kwargs):
        if not BOT_INTERNAL_TOKEN:
            return jsonify({'error': 'Service misconfigured'}), 503
        token = request.headers.get('X-Bot-Token') or request.headers.get('X-Chatbot-Token')
        if token != BOT_INTERNAL_TOKEN:
            return jsonify({'error': 'Forbidden'}), 403
        return f(*args, **kwargs)

    return decorated
