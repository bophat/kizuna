from django.utils.dateparse import parse_datetime
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from shop.models import Order

from .models import PendingReply


class AdminNotificationFeedView(APIView):
    """Poll-based notifications — works without Flask chatbot (orders always)."""

    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        since_param = (request.query_params.get('since') or '').strip()
        since_dt = parse_datetime(since_param) if since_param else None

        orders_qs = Order.objects.all().order_by('-created_at')
        if since_dt:
            orders_qs = orders_qs.filter(created_at__gt=since_dt)
        else:
            orders_qs = orders_qs[:20]

        items = []
        for order in orders_qs:
            items.append({
                'id': f'order_{order.id}',
                'type': 'ORDER',
                'title': 'Đơn hàng mới từ Website',
                'message': f'Mã đơn: #{order.id} - Tổng: {order.total_amount}',
                'timestamp': order.created_at.isoformat(),
            })

        pending_qs = PendingReply.objects.filter(
            status=PendingReply.Status.PENDING,
        ).order_by('-created_at')
        if since_dt:
            pending_qs = pending_qs.filter(created_at__gt=since_dt)
        else:
            pending_qs = pending_qs[:10]

        for pending in pending_qs:
            items.append({
                'id': f'approval_{pending.id}',
                'type': 'CHAT',
                'title': 'Tin nhắn chờ duyệt',
                'message': (pending.incoming_message or pending.draft_reply or '')[:200],
                'timestamp': pending.created_at.isoformat(),
            })

        items.sort(key=lambda x: x['timestamp'], reverse=True)
        return Response(items)
