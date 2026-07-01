from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

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
        return Response({'enabled': is_chatbot_enabled()})


class ChatSessionsProxyView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        if not is_chatbot_enabled():
            return Response({})
        try:
            res = forward_to_chatbot('GET', '/api/chat/sessions')
            return Response(res.json(), status=res.status_code)
        except ChatbotDisabledError:
            return Response({})
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class ChatReplyProxyView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, session_id):
        if not is_chatbot_enabled():
            return Response(
                {'error': 'Chatbot is disabled. Enable it in Settings → Integrations.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        try:
            res = forward_to_chatbot(
                'POST',
                f'/api/chat/{session_id}/reply',
                json=request.data,
            )
            return Response(res.json(), status=res.status_code)
        except ChatbotDisabledError:
            return Response(
                {'error': 'Chatbot is disabled'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


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
