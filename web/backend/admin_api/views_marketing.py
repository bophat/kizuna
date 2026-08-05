"""Admin campaign API and public email-unsubscribe endpoint."""

from html import escape

from django.core import signing
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.http import HttpResponse
from django.urls import reverse
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .marketing import (
    build_campaign_message,
    read_unsubscribe_token,
    send_campaign_batch,
)
from .models import (
    MarketingCampaign,
    MarketingEmailDelivery,
    MarketingEmailSuppression,
)
from .serializers import MarketingCampaignSerializer


class MarketingCampaignViewSet(viewsets.ModelViewSet):
    queryset = (
        MarketingCampaign.objects
        .select_related('product', 'created_by', 'sent_by')
        .all()
    )
    serializer_class = MarketingCampaignSerializer
    permission_classes = [permissions.IsAdminUser]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        campaign = self.get_object()
        if campaign.status != MarketingCampaign.Status.DRAFT:
            return Response(
                {'detail': 'Only draft campaigns can be deleted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    def _unsubscribe_base_url(self, request):
        return request.build_absolute_uri(reverse('marketing-unsubscribe'))

    @action(detail=True, methods=['post'], url_path='send-test')
    def send_test(self, request, pk=None):
        campaign = self.get_object()
        email = str(request.data.get('email') or request.user.email or '').strip().lower()
        try:
            validate_email(email)
        except DjangoValidationError:
            return Response(
                {'email': ['Enter a valid test email address.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        delivery = MarketingEmailDelivery(
            campaign=campaign,
            user=request.user,
            email=email,
            customer_name=request.user.get_full_name().strip() or request.user.username,
        )
        try:
            message = build_campaign_message(
                campaign,
                delivery,
                self._unsubscribe_base_url(request),
            )
            if message.send(fail_silently=False) != 1:
                raise RuntimeError('Email backend did not accept the test message')
        except Exception as exc:
            return Response(
                {'detail': f'Unable to send test email: {str(exc)[:300]}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({'detail': 'Test email sent.', 'email': email})

    @action(detail=True, methods=['post'], url_path='send-batch')
    def send_batch(self, request, pk=None):
        campaign = self.get_object()
        if campaign.status in (
            MarketingCampaign.Status.SENT,
            MarketingCampaign.Status.PARTIAL,
        ):
            return Response(
                {
                    'detail': 'Campaign has no pending recipients.',
                    'campaign': self.get_serializer(campaign).data,
                    'has_more': False,
                }
            )
        if not campaign.sent_by_id:
            campaign.sent_by = request.user
            campaign.save(update_fields=['sent_by', 'updated_at'])
        try:
            result = send_campaign_batch(
                campaign,
                self._unsubscribe_base_url(request),
                request.data.get('batch_size', 20),
            )
        except (TypeError, ValueError):
            return Response(
                {'batch_size': ['Batch size must be a number between 1 and 50.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        campaign.refresh_from_db()
        return Response(
            {
                **result,
                'campaign': self.get_serializer(campaign).data,
            }
        )

    @action(detail=True, methods=['post'], url_path='retry-failed')
    def retry_failed(self, request, pk=None):
        campaign = self.get_object()
        if campaign.status != MarketingCampaign.Status.PARTIAL:
            return Response(
                {'detail': 'Only partially sent campaigns can retry failed recipients.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        reset_count = campaign.deliveries.filter(
            status=MarketingEmailDelivery.Status.FAILED
        ).update(
            status=MarketingEmailDelivery.Status.PENDING,
            error_message='',
            sent_at=None,
            updated_at=timezone.now(),
        )
        campaign.status = MarketingCampaign.Status.SENDING
        campaign.failed_count = 0
        campaign.completed_at = None
        campaign.save(
            update_fields=['status', 'failed_count', 'completed_at', 'updated_at']
        )
        return Response(
            {
                'detail': 'Failed recipients are ready to retry.',
                'reset_count': reset_count,
                'campaign': self.get_serializer(campaign).data,
            }
        )


class MarketingUnsubscribeView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def _read_email(self, request):
        token = str(request.query_params.get('token') or request.data.get('token') or '')
        return token, read_unsubscribe_token(token)

    def get(self, request):
        try:
            token, email = self._read_email(request)
        except (signing.BadSignature, TypeError, ValueError):
            return HttpResponse(
                '<h1>Liên kết không hợp lệ</h1><p>Không thể xác nhận yêu cầu hủy email.</p>',
                status=400,
                content_type='text/html; charset=utf-8',
            )
        safe_token = escape(token, quote=True)
        safe_email = escape(email)
        return HttpResponse(
            f'''<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hủy email KIZUNA</title></head>
            <body style="font-family:Arial,sans-serif;background:#f7f4f1;color:#24201f;padding:40px 16px"><main style="max-width:560px;margin:auto;background:#fff;border:1px solid #e8e1dc;border-radius:16px;padding:32px">
            <h1 style="font-family:Georgia,serif;color:#99051d">Hủy nhận email marketing</h1>
            <p>Bạn có muốn ngừng nhận thông báo sự kiện và sản phẩm mới tại <strong>{safe_email}</strong>?</p>
            <form method="post"><input type="hidden" name="token" value="{safe_token}"><button type="submit" style="border:0;border-radius:8px;background:#99051d;color:#fff;padding:13px 20px;font-weight:bold;cursor:pointer">Xác nhận hủy nhận email</button></form>
            </main></body></html>''',
            content_type='text/html; charset=utf-8',
        )

    def post(self, request):
        try:
            _, email = self._read_email(request)
        except (signing.BadSignature, TypeError, ValueError):
            return HttpResponse(
                '<h1>Liên kết không hợp lệ</h1><p>Không thể xác nhận yêu cầu hủy email.</p>',
                status=400,
                content_type='text/html; charset=utf-8',
            )
        MarketingEmailSuppression.objects.get_or_create(
            email=email,
            defaults={'reason': 'unsubscribe'},
        )
        return HttpResponse(
            '<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Arial,sans-serif;background:#f7f4f1;color:#24201f;padding:40px 16px"><main style="max-width:560px;margin:auto;background:#fff;border:1px solid #e8e1dc;border-radius:16px;padding:32px"><h1 style="font-family:Georgia,serif;color:#99051d">Đã hủy nhận email</h1><p>KIZUNA sẽ không gửi thêm email marketing đến địa chỉ này.</p></main></body></html>',
            content_type='text/html; charset=utf-8',
        )
