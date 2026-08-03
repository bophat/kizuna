from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db.models import Sum
from django.utils import timezone

from .models import AffiliateCommission, AffiliatePayout, AffiliateProfile


MONEY_STEP = Decimal('0.01')


def normalize_affiliate_code(code):
    return str(code or '').strip().upper()


def resolve_active_affiliate(code, customer=None, for_update=False):
    code = normalize_affiliate_code(code)
    if not code:
        return None
    queryset = AffiliateProfile.objects.select_related('user')
    if for_update:
        queryset = queryset.select_for_update()
    affiliate = queryset.filter(code=code, status=AffiliateProfile.Status.ACTIVE).first()
    if affiliate and customer and affiliate.user_id == customer.id:
        return None
    return affiliate


def calculate_commission(base_amount, rate):
    base_amount = max(Decimal('0.00'), Decimal(base_amount))
    rate = Decimal(rate)
    return (base_amount * rate / Decimal('100')).quantize(
        MONEY_STEP, rounding=ROUND_HALF_UP
    )


def create_order_commission(order, affiliate):
    base_amount = max(
        Decimal('0.00'), order.subtotal_amount - order.discount_amount
    ).quantize(MONEY_STEP, rounding=ROUND_HALF_UP)
    amount = calculate_commission(base_amount, order.affiliate_commission_rate)
    if amount <= 0:
        return None
    commission, _ = AffiliateCommission.objects.get_or_create(
        order=order,
        defaults={
            'affiliate': affiliate,
            'base_amount': base_amount,
            'commission_rate': order.affiliate_commission_rate,
            'amount': amount,
        },
    )
    return commission


def refresh_available_commissions():
    now = timezone.now()
    return AffiliateCommission.objects.filter(
        status=AffiliateCommission.Status.PENDING,
        order__status='delivered',
        available_at__isnull=False,
        available_at__lte=now,
        payout__isnull=True,
    ).update(status=AffiliateCommission.Status.AVAILABLE, updated_at=now)


def sync_order_commission(order, old_status):
    try:
        commission = order.affiliate_commission
    except AffiliateCommission.DoesNotExist:
        return

    now = timezone.now()
    if order.status == 'cancelled':
        if commission.status == AffiliateCommission.Status.PAID:
            commission.status = AffiliateCommission.Status.REVERSED
            commission.reversed_at = now
            commission.save(update_fields=['status', 'reversed_at', 'updated_at'])
            return
        if commission.payout_id:
            payout = commission.payout
            commission.payout = None
            commission.save(update_fields=['payout', 'updated_at'])
            payout.total_amount = (
                payout.commissions.aggregate(total=Sum('amount'))['total']
                or Decimal('0.00')
            )
            if payout.total_amount <= 0:
                payout.status = AffiliatePayout.Status.CANCELLED
                payout.save(update_fields=['total_amount', 'status', 'updated_at'])
            else:
                payout.save(update_fields=['total_amount', 'updated_at'])
        commission.status = AffiliateCommission.Status.REVERSED
        commission.reversed_at = now
        commission.available_at = None
        commission.save(
            update_fields=['status', 'reversed_at', 'available_at', 'updated_at']
        )
        return

    if old_status == 'cancelled' and commission.status == AffiliateCommission.Status.REVERSED:
        commission.status = AffiliateCommission.Status.PENDING
        commission.reversed_at = None

    if order.status == 'delivered':
        return_days = max(0, int(getattr(settings, 'AFFILIATE_RETURN_WINDOW_DAYS', 14)))
        commission.available_at = now + timedelta(days=return_days)
        if return_days == 0:
            commission.status = AffiliateCommission.Status.AVAILABLE
    elif old_status == 'delivered' and commission.status != AffiliateCommission.Status.PAID:
        commission.status = AffiliateCommission.Status.PENDING
        commission.available_at = None

    commission.save(
        update_fields=['status', 'available_at', 'reversed_at', 'updated_at']
    )
