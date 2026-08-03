from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
from urllib.parse import urlencode

from django.db import transaction
from django.utils import timezone

from .affiliates import sync_order_commission
from .models import PaymentMethodConfig, PaymentTransaction
from .shipping import get_exchange_rates


def normalize_payment_method(value):
    aliases = {
        'cash': PaymentMethodConfig.Code.COD,
        'transfer': PaymentMethodConfig.Code.BANK_TRANSFER,
    }
    value = str(value or '').strip().lower()
    return aliases.get(value, value)


def enabled_payment_method(code, for_update=False):
    code = normalize_payment_method(code)
    queryset = PaymentMethodConfig.objects.filter(enabled=True)
    if for_update:
        queryset = queryset.select_for_update()
    return queryset.filter(code=code).first()


def localized_instructions(method, language):
    language = str(language or 'en').split('-')[0]
    if language not in {'en', 'ja', 'vi'}:
        language = 'en'
    return getattr(method, f'instructions_{language}', '') or method.instructions_en


def payment_method_snapshot(method):
    snapshot = {
        'code': method.code,
        'currency': method.currency,
        'instructions_en': method.instructions_en,
        'instructions_ja': method.instructions_ja,
        'instructions_vi': method.instructions_vi,
    }
    if method.code == PaymentMethodConfig.Code.BANK_TRANSFER:
        snapshot.update({
            'bank_name': method.bank_name,
            'bank_bin': method.bank_bin,
            'account_name': method.account_name,
            'account_number': method.account_number,
        })
    return snapshot


def _settlement_values(amount_usd, currency):
    currency = str(currency or 'VND').upper()
    if currency == 'USD':
        return Decimal(amount_usd).quantize(Decimal('1'), rounding=ROUND_HALF_UP), Decimal('1')
    if currency != 'VND':
        raise ValueError('Only USD and VND settlement currencies are supported.')
    rate = Decimal(str(get_exchange_rates().get('usd_to_vnd') or '25000'))
    amount = (Decimal(amount_usd) * rate).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    return amount, rate


def create_payment_transaction(order, method):
    settlement_amount, rate = _settlement_values(order.total_amount, method.currency)
    is_cod = method.code == PaymentMethodConfig.Code.COD
    return PaymentTransaction.objects.create(
        order=order,
        method=method.code,
        status=(
            PaymentTransaction.Status.COD_PENDING
            if is_cod else PaymentTransaction.Status.PENDING
        ),
        amount_usd=order.total_amount,
        settlement_amount=settlement_amount,
        settlement_currency=method.currency,
        exchange_rate=rate,
        reference=f'KZ{order.id:010d}',
        method_snapshot=payment_method_snapshot(method),
        expires_at=(
            None if is_cod else timezone.now() + timedelta(minutes=method.expiry_minutes)
        ),
    )


def payment_qr_url(payment):
    if (
        payment.method != PaymentMethodConfig.Code.BANK_TRANSFER
        or payment.settlement_currency != 'VND'
    ):
        return ''
    details = payment.method_snapshot or {}
    bank_bin = str(details.get('bank_bin') or '').strip()
    account_number = str(details.get('account_number') or '').strip()
    if not bank_bin or not account_number:
        return ''
    query = urlencode({
        'amount': int(payment.settlement_amount),
        'addInfo': payment.reference,
        'accountName': details.get('account_name') or '',
    })
    return f'https://img.vietqr.io/image/{bank_bin}-{account_number}-compact2.png?{query}'


def restore_order_inventory(order):
    for item in order.items.select_related('product').all():
        if item.product:
            item.product.stock += item.quantity
            item.product.sales = max(0, item.product.sales - item.quantity)
            item.product.save(update_fields=['stock', 'sales', 'updated_at'])


def expire_payment(payment):
    if (
        payment.status == PaymentTransaction.Status.PENDING
        and payment.expires_at
        and payment.expires_at <= timezone.now()
    ):
        old_order_status = payment.order.status
        payment.status = PaymentTransaction.Status.EXPIRED
        payment.failure_reason = 'Payment window expired.'
        payment.save(update_fields=['status', 'failure_reason', 'updated_at'])
        if payment.order.status != 'cancelled':
            restore_order_inventory(payment.order)
            payment.order.status = 'cancelled'
            payment.order.save(update_fields=['status', 'updated_at'])
            sync_order_commission(payment.order, old_order_status)
        return True
    return False


def expire_pending_payments():
    payment_ids = list(
        PaymentTransaction.objects.filter(
            status=PaymentTransaction.Status.PENDING,
            expires_at__isnull=False,
            expires_at__lte=timezone.now(),
        ).values_list('id', flat=True)
    )
    expired = 0
    for payment_id in payment_ids:
        with transaction.atomic():
            payment = (
                PaymentTransaction.objects.select_for_update()
                .select_related('order')
                .get(pk=payment_id)
            )
            expired += int(expire_payment(payment))
    return expired
