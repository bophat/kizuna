from django.utils.dateparse import parse_datetime
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from shop.models import ConciergeMessage, Order, PaymentTransaction

from .models import PendingReply


class AdminNotificationFeedView(APIView):
    """Poll-based notifications — works without Flask chatbot (orders always)."""

    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        since_param = (request.query_params.get('since') or '').strip()
        since_dt = parse_datetime(since_param) if since_param else None

        orders_qs = (
            Order.objects.select_related('payment')
            .filter(payment__status__in=[
                PaymentTransaction.Status.COD_PENDING,
                PaymentTransaction.Status.COD_COLLECTED,
            ])
            .order_by('-created_at')
        )
        if since_dt:
            orders_qs = orders_qs.filter(created_at__gt=since_dt)
        else:
            orders_qs = orders_qs[:20]

        items = []
        for order in orders_qs:
            items.append({
                'id': f'order_{order.id}',
                'type': 'ORDER',
                'event': 'order_cod_ready',
                'order_id': order.id,
                'title': 'Đơn COD cần đóng gói',
                'message': f'Đơn #{order.id} - Tổng: {order.total_amount}',
                'data': {'order_id': order.id, 'amount': str(order.total_amount)},
                'timestamp': order.created_at.isoformat(),
            })

        payments = PaymentTransaction.objects.select_related('order').filter(
            method='bank_transfer'
        )
        proof_qs = payments.filter(proof_submitted_at__isnull=False)
        paid_qs = payments.filter(paid_at__isnull=False)
        if since_dt:
            proof_qs = proof_qs.filter(proof_submitted_at__gt=since_dt)
            paid_qs = paid_qs.filter(paid_at__gt=since_dt)
        else:
            proof_qs = proof_qs.order_by('-proof_submitted_at')[:20]
            paid_qs = paid_qs.order_by('-paid_at')[:20]

        for payment in proof_qs:
            items.append({
                'id': f'payment_proof_{payment.id}_{payment.proof_submitted_at.isoformat()}',
                'type': 'PAYMENT',
                'event': 'payment_proof_submitted',
                'order_id': payment.order_id,
                'title': 'Khách đã gửi biên lai',
                'message': f'Đơn #{payment.order_id} cần xác minh thanh toán.',
                'data': {
                    'order_id': payment.order_id,
                    'amount': str(payment.settlement_amount),
                    'currency': payment.settlement_currency,
                },
                'timestamp': payment.proof_submitted_at.isoformat(),
            })

        for payment in paid_qs:
            items.append({
                'id': f'payment_paid_{payment.id}',
                'type': 'PAYMENT',
                'event': 'payment_succeeded',
                'order_id': payment.order_id,
                'title': 'Thanh toán thành công',
                'message': f'Đơn #{payment.order_id} đã sẵn sàng để đóng gói.',
                'data': {
                    'order_id': payment.order_id,
                    'amount': str(payment.settlement_amount),
                    'currency': payment.settlement_currency,
                },
                'timestamp': payment.paid_at.isoformat(),
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

        concierge_qs = ConciergeMessage.objects.filter(
            role=ConciergeMessage.Role.USER,
        ).select_related('session').order_by('-created_at')
        if since_dt:
            concierge_qs = concierge_qs.filter(created_at__gt=since_dt)
        else:
            concierge_qs = concierge_qs[:15]

        for msg in concierge_qs:
            items.append({
                'id': f'concierge_{msg.id}',
                'type': 'CHAT',
                'title': 'Tin nhắn từ Website',
                'message': msg.content[:200],
                'timestamp': msg.created_at.isoformat(),
                'session_id': msg.session.session_id,
            })

        items.sort(key=lambda x: x['timestamp'], reverse=True)
        return Response(items)
