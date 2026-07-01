from django.http import HttpResponse, HttpResponseBadRequest
from django.views import View
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .concierge import generate_concierge_reply
from .throttles import ConciergeRateThrottle


class ConciergeLiveStatusView(APIView):
    """Whether Flask live-chat bridge is active (admin reply / SSE)."""

    permission_classes = [AllowAny]

    def get(self, request):
        from admin_api.chat_proxy import is_chatbot_enabled

        return Response({'live': is_chatbot_enabled()})


class ConciergeReplyView(APIView):
    """Server-side Gemini proxy — API key never sent to browser."""

    permission_classes = [AllowAny]
    throttle_classes = [ConciergeRateThrottle]

    def post(self, request):
        message = (request.data.get('message') or '').strip()[:2000]
        if not message:
            return Response({'error': 'message is required'}, status=status.HTTP_400_BAD_REQUEST)
        history = request.data.get('history') or []
        if not isinstance(history, list):
            history = []
        try:
            reply = generate_concierge_reply(message, history)
            return Response({'reply': reply})
        except Exception:
            return Response(
                {'error': 'AI service unavailable'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class ConciergeMessageView(APIView):
    """Proxy website chat messages to Flask (token never exposed to browser)."""

    permission_classes = [AllowAny]
    throttle_classes = [ConciergeRateThrottle]

    def post(self, request):
        message = (request.data.get('message') or '')[:4000]
        session_id = (request.data.get('session_id') or '').strip()[:128]
        sender = (request.data.get('sender') or 'user').strip()[:16]
        if not session_id:
            return Response({'error': 'session_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        from admin_api.chat_proxy import ChatbotDisabledError, forward_to_chatbot, is_chatbot_enabled

        if not is_chatbot_enabled():
            return Response({'status': 'success', 'adminTookOver': False, 'chatbot_disabled': True})

        try:
            res = forward_to_chatbot(
                'POST',
                '/api/internal/concierge/message',
                json={'message': message, 'session_id': session_id, 'sender': sender},
                timeout=15,
            )
            return Response(res.json(), status=res.status_code)
        except ChatbotDisabledError:
            return Response({'status': 'success', 'adminTookOver': False, 'chatbot_disabled': True})
        except Exception:
            return Response(
                {'error': 'Chat service unavailable'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class ConciergeStreamView(View):
    """SSE proxy for admin replies to website concierge sessions."""

    def get(self, request, session_id):
        from admin_api.chat_proxy import is_chatbot_enabled, sse_streaming_response, stream_concierge_session
        from admin_api.sse_cors import apply_sse_cors

        session_id = (session_id or '').strip()[:128]
        if not session_id:
            return apply_sse_cors(HttpResponseBadRequest('session_id is required'), request)
        if not is_chatbot_enabled():
            return sse_streaming_response(iter(()), request)
        return sse_streaming_response(stream_concierge_session(session_id), request)

    def options(self, request, session_id):
        from admin_api.sse_cors import apply_sse_cors

        return apply_sse_cors(HttpResponse(status=204), request)
