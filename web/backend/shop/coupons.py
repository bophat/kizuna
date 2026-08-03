from decimal import Decimal, ROUND_HALF_UP

from django.utils import timezone

from .models import Coupon


MONEY_STEP = Decimal('0.01')


class CouponValidationError(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def normalize_coupon_code(code):
    return str(code or '').strip().upper()


def calculate_discount(coupon, subtotal):
    subtotal = Decimal(subtotal).quantize(MONEY_STEP, rounding=ROUND_HALF_UP)
    if coupon.discount_type == Coupon.DiscountType.PERCENTAGE:
        discount = subtotal * coupon.discount_value / Decimal('100')
        if coupon.maximum_discount_amount is not None:
            discount = min(discount, coupon.maximum_discount_amount)
    else:
        discount = coupon.discount_value
    return min(subtotal, discount).quantize(MONEY_STEP, rounding=ROUND_HALF_UP)


def validate_coupon(coupon, user, subtotal, now=None):
    now = now or timezone.now()
    subtotal = Decimal(subtotal)

    if not coupon.is_active:
        raise CouponValidationError('inactive')
    if coupon.starts_at and now < coupon.starts_at:
        raise CouponValidationError('not_started')
    if coupon.expires_at and now >= coupon.expires_at:
        raise CouponValidationError('expired')
    if coupon.usage_limit is not None and coupon.used_count >= coupon.usage_limit:
        raise CouponValidationError('usage_limit_reached')
    if subtotal < coupon.minimum_order_amount:
        raise CouponValidationError('minimum_order_not_met')
    if (
        coupon.per_user_limit is not None
        and coupon.redemptions.filter(user=user).count() >= coupon.per_user_limit
    ):
        raise CouponValidationError('per_user_limit_reached')

    return calculate_discount(coupon, subtotal)


def coupon_payload(coupon, subtotal, discount_amount):
    subtotal = Decimal(subtotal).quantize(MONEY_STEP, rounding=ROUND_HALF_UP)
    discount_amount = Decimal(discount_amount).quantize(MONEY_STEP, rounding=ROUND_HALF_UP)
    return {
        'valid': True,
        'code': coupon.code,
        'discount_type': coupon.discount_type,
        'discount_value': coupon.discount_value,
        'minimum_order_amount': coupon.minimum_order_amount,
        'maximum_discount_amount': coupon.maximum_discount_amount,
        'subtotal_amount': subtotal,
        'discount_amount': discount_amount,
        'total_after_discount': max(Decimal('0.00'), subtotal - discount_amount),
    }
