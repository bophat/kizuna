from django.http import HttpResponse, HttpResponseBadRequest
from django.views import View
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .concierge import generate_concierge_reply
from .concierge_store import (
    handle_user_message,
    is_ai_enabled,
    session_history,
    stream_concierge_session_messages,
)
from .throttles import ConciergeRateThrottle


class ConciergeLiveStatusView(APIView):
    """AI auto-reply vs manual admin mode."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            'live': True,
            'aiEnabled': is_ai_enabled(),
        })


class ConciergeHistoryView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        session_id = (request.query_params.get('session_id') or '').strip()[:128]
        if not session_id:
            return Response({'error': 'session_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        data = session_history(session_id)
        if data is None:
            return Response({'messages': [], 'adminTookOver': False, 'aiEnabled': is_ai_enabled()})
        return Response(data)


class ConciergeReplyView(APIView):
    """Legacy AI-only endpoint — prefer POST /concierge/message/."""

    permission_classes = [AllowAny]
    throttle_classes = [ConciergeRateThrottle]

    def post(self, request):
        if not is_ai_enabled():
            return Response(
                {'error': 'AI concierge is disabled — an admin will reply shortly.'},
                status=status.HTTP_403_FORBIDDEN,
            )
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
    """Website concierge: always saves to Django; AI replies when enabled."""

    permission_classes = [AllowAny]
    throttle_classes = [ConciergeRateThrottle]

    def post(self, request):
        message = (request.data.get('message') or '').strip()[:4000]
        session_id = (request.data.get('session_id') or '').strip()[:128]
        if not message:
            return Response({'error': 'message is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not session_id:
            return Response({'error': 'session_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        result = handle_user_message(session_id, message)
        return Response(result)


class ConciergeStreamView(View):
    """SSE for admin replies to website concierge sessions (Django-backed)."""

    def get(self, request, session_id):
        from admin_api.chat_proxy import sse_streaming_response
        from admin_api.sse_cors import apply_sse_cors

        session_id = (session_id or '').strip()[:128]
        if not session_id:
            return apply_sse_cors(HttpResponseBadRequest('session_id is required'), request)
        return sse_streaming_response(stream_concierge_session_messages(session_id), request)

    def options(self, request, session_id):
        from admin_api.sse_cors import apply_sse_cors

        return apply_sse_cors(HttpResponse(status=204), request)
