from django.http import JsonResponse
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.sse import SseView, sse_response

from .chat_proxy import (
    create_sse_ticket,
    forward_to_chatbot,
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


class ChatNotificationsStreamView(SseView):
    """SSE proxy — EventSource cannot send Authorization; use one-time ticket."""

    def get(self, request):
        ticket = request.GET.get('ticket', '')
        if not validate_sse_ticket(ticket):
            return JsonResponse({'error': 'Invalid or expired ticket'}, status=403)
        try:
            return sse_response(stream_chatbot_notifications())
        except Exception as exc:
            return JsonResponse({'error': str(exc)}, status=502)
