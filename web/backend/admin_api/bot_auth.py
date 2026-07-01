import os

from rest_framework.permissions import BasePermission


class IsChatbotService(BasePermission):
    """Allow chatbot/newfeed services with X-Bot-Token header."""

    def has_permission(self, request, view):
        expected = os.environ.get('CHATBOT_INTERNAL_TOKEN', '')
        if not expected:
            return False
        token = request.headers.get('X-Bot-Token') or request.headers.get('X-Chatbot-Token')
        return token == expected
