"""Plain Django views for SSE — bypasses DRF content negotiation (406 on EventSource)."""

from django.http import JsonResponse, StreamingHttpResponse
from django.views import View


def sse_response(stream) -> StreamingHttpResponse:
    response = StreamingHttpResponse(stream, content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response


class SseView(View):
    """Base view for Server-Sent Events endpoints."""

    def dispatch(self, request, *args, **kwargs):
        if request.method != 'GET':
            return JsonResponse({'error': 'Method not allowed'}, status=405)
        return super().dispatch(request, *args, **kwargs)
