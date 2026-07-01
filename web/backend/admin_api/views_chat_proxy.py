from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from shop.concierge_store import admin_reply, is_ai_enabled, sessions_for_admin

from .chat_proxy import (
    ChatbotDisabledError,
    create_sse_ticket,
    forward_to_chatbot,
    is_chatbot_enabled,
    sse_streaming_response,
    stream_chatbot_notifications,
    validate_sse_ticket,
)
from .sse_cors import apply_sse_cors, sse_forbidden
from django.http import HttpResponse
from django.views import View


class ChatStatusView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        return Response({
            'enabled': True,
            'aiEnabled': is_ai_enabled(),
            'flaskBridge': is_chatbot_enabled(),
        })


class ChatSessionsProxyView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        django_sessions = sessions_for_admin()
        if not is_chatbot_enabled():
            return Response(django_sessions)
        try:
            res = forward_to_chatbot('GET', '/api/chat/sessions')
            flask_sessions = res.json() if res.ok else {}
            merged = {**flask_sessions, **django_sessions}
            return Response(merged)
        except (ChatbotDisabledError, Exception):
            return Response(django_sessions)


class ChatReplyProxyView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, session_id):
        message = (request.data.get('message') or '').strip()[:4000]
        if not message:
            return Response({'error': 'message is required'}, status=status.HTTP_400_BAD_REQUEST)

        result = admin_reply(session_id, message)

        if is_chatbot_enabled():
            try:
                forward_to_chatbot(
                    'POST',
                    f'/api/chat/{session_id}/reply',
                    json={'message': message},
                )
            except Exception:
                pass

        return Response(result)


class ChatSseTicketView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        if not is_chatbot_enabled():
            return Response({'enabled': False}, status=status.HTTP_200_OK)
        ticket = create_sse_ticket(request.user.id)
        return Response({'ticket': ticket, 'enabled': True})


class ChatNotificationsStreamView(View):
    """SSE proxy — plain Django view (DRF returns 406 for text/event-stream)."""

    def get(self, request):
        if not is_chatbot_enabled():
            return sse_streaming_response(iter(()), request)

        ticket = request.GET.get('ticket', '')
        if not validate_sse_ticket(ticket):
            return sse_forbidden(request, 'Invalid or expired ticket')
        return sse_streaming_response(stream_chatbot_notifications(), request)

    def options(self, request):
        return apply_sse_cors(HttpResponse(status=204), request)
