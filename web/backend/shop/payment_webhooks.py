import hashlib
import hmac
import json
import re
import time
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PaymentMethodConfig, PaymentTransaction, PaymentWebhookEvent
from .payments import expire_payment


SEPAY_PROVIDER = 'sepay'
PAYMENT_REFERENCE_PATTERN = re.compile(r'\bKZ[A-Z0-9]{10,40}\b', re.IGNORECASE)


def _sepay_signature_is_valid(request, raw_body):
    secret = settings.SEPAY_WEBHOOK_SECRET
    signature = request.headers.get('X-SePay-Signature', '')
    timestamp_value = request.headers.get('X-SePay-Timestamp', '')
    if not secret or not signature or not timestamp_value:
        return False

    try:
        timestamp = int(timestamp_value)
    except (TypeError, ValueError):
        return False

    max_age = max(1, settings.SEPAY_WEBHOOK_MAX_AGE_SECONDS)
    if abs(int(time.time()) - timestamp) > max_age:
        return False

    signed_payload = timestamp_value.encode('utf-8') + b'.' + raw_body
    expected = 'sha256=' + hmac.new(
        secret.encode('utf-8'),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def _extract_payment_reference(payload):
    values = (
        payload.get('code'),
        payload.get('content'),
        payload.get('description'),
        payload.get('subAccount'),
    )
    for value in values:
        match = PAYMENT_REFERENCE_PATTERN.search(str(value or '').upper())
        if match:
            return match.group(0).upper()
    return ''


def _normalize_account_number(value):
    return re.sub(r'[\s-]+', '', str(value or '')).upper()


def _ignore_event(event, reason, payment=None):
    event.status = PaymentWebhookEvent.Status.IGNORED
    event.reason = reason
    event.payment = payment
    event.processed_at = timezone.now()
    event.save(update_fields=[
        'status', 'reason', 'payment', 'processed_at',
    ])


class SepayWebhookView(APIView):
    """Receive authenticated SePay credit events and settle matching orders."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        raw_body = request.body
        if not settings.SEPAY_WEBHOOK_SECRET:
            return Response(
                {'success': False, 'message': 'Webhook is not configured.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if not _sepay_signature_is_valid(request, raw_body):
            return Response(
                {'success': False, 'message': 'Invalid webhook signature.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            payload = json.loads(raw_body.decode('utf-8'))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return Response(
                {'success': False, 'message': 'Invalid JSON payload.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not isinstance(payload, dict):
            return Response(
                {'success': False, 'message': 'Invalid webhook payload.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event_id = str(payload.get('id') or '').strip()
        if not event_id or len(event_id) > 100:
            return Response(
                {'success': False, 'message': 'Missing transaction id.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            event, created = PaymentWebhookEvent.objects.get_or_create(
                provider=SEPAY_PROVIDER,
                event_id=event_id,
                defaults={
                    'status': PaymentWebhookEvent.Status.IGNORED,
                    'reason': 'received',
                    'payload': payload,
                },
            )
            if not created:
                return Response({'success': True})

            if str(payload.get('transferType') or '').lower() != 'in':
                _ignore_event(event, 'not_incoming_transfer')
                return Response({'success': True})

            reference = _extract_payment_reference(payload)
            if not reference:
                _ignore_event(event, 'payment_reference_not_found')
                return Response({'success': True})

            payment = (
                PaymentTransaction.objects.select_for_update()
                .select_related('order')
                .filter(
                    reference__iexact=reference,
                    method=PaymentMethodConfig.Code.BANK_TRANSFER,
                )
                .first()
            )
            if payment is None:
                _ignore_event(event, 'payment_not_found')
                return Response({'success': True})

            expire_payment(payment)
            if payment.status == PaymentTransaction.Status.PAID:
                _ignore_event(event, 'payment_already_paid', payment)
                return Response({'success': True})
            if payment.status not in {
                PaymentTransaction.Status.PENDING,
                PaymentTransaction.Status.PROOF_SUBMITTED,
            }:
                _ignore_event(event, f'payment_status_{payment.status}', payment)
                return Response({'success': True})

            try:
                transfer_amount = Decimal(str(payload.get('transferAmount')))
            except (InvalidOperation, TypeError, ValueError):
                _ignore_event(event, 'invalid_transfer_amount', payment)
                return Response({'success': True})
            if (
                transfer_amount <= 0
                or transfer_amount != transfer_amount.to_integral_value()
                or transfer_amount != payment.settlement_amount
            ):
                _ignore_event(event, 'settlement_amount_mismatch', payment)
                return Response({'success': True})

            account_number = _normalize_account_number(payload.get('accountNumber'))
            expected_account = _normalize_account_number(
                (payment.method_snapshot or {}).get('account_number')
            )
            if not expected_account:
                current_method = PaymentMethodConfig.objects.filter(
                    code=PaymentMethodConfig.Code.BANK_TRANSFER,
                ).first()
                expected_account = _normalize_account_number(
                    current_method.account_number if current_method else ''
                )
            if not expected_account or account_number != expected_account:
                _ignore_event(event, 'bank_account_mismatch', payment)
                return Response({'success': True})

            now = timezone.now()
            payment.provider = SEPAY_PROVIDER
            payment.status = PaymentTransaction.Status.PAID
            payment.paid_at = now
            payment.verified_at = now
            payment.verified_by = None
            payment.failure_reason = ''
            payment.save(update_fields=[
                'provider', 'status', 'paid_at', 'verified_at', 'verified_by',
                'failure_reason', 'updated_at',
            ])

            order = payment.order
            if order.status == 'pending':
                order.status = 'processing'
                order.save(update_fields=['status', 'updated_at'])

            event.payment = payment
            event.status = PaymentWebhookEvent.Status.PROCESSED
            event.reason = 'payment_confirmed'
            event.processed_at = now
            event.save(update_fields=[
                'payment', 'status', 'reason', 'processed_at',
            ])

        return Response({'success': True})
