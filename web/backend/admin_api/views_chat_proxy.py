from django.http import HttpResponseForbidden
from django.views import View
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .chat_proxy import (
    create_sse_ticket,
    forward_to_chatbot,
    sse_streaming_response,
    stream_chatbot_notifications,
    validate_sse_ticket,
)


class ChatSessionsProxyView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        try:
            res = forward_to_chatbot('GET', '/api/chat/sessions')
            return Response(res.json(), status=res.status_code)
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


class ChatReplyProxyView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, session_id):
        try:
            res = forward_to_chatbot(
                'POST',
                f'/api/chat/{session_id}/reply',
                json=request.data,
            )
            return Response(res.json(), status=res.status_code)
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


class ChatSseTicketView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        ticket = create_sse_ticket(request.user.id)
        return Response({'ticket': ticket})


class ChatNotificationsStreamView(View):
    """SSE proxy — plain Django view (DRF returns 406 for text/event-stream)."""

    def get(self, request):
        ticket = request.GET.get('ticket', '')
        if not validate_sse_ticket(ticket):
            return HttpResponseForbidden('Invalid or expired ticket')
        try:
            return sse_streaming_response(stream_chatbot_notifications())
        except Exception:
            return HttpResponseForbidden('Stream unavailable')
