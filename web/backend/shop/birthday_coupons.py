"""Issue account-bound, one-use birthday coupons."""

from __future__ import annotations

import secrets
from decimal import Decimal

from django.conf import settings
from django.db import IntegrityError, transaction

from .models import Coupon


def _coupon_defaults():
    discount_percent = Decimal(str(settings.BIRTHDAY_COUPON_DISCOUNT_PERCENT))
    minimum_order_vnd = Decimal(str(settings.BIRTHDAY_COUPON_MINIMUM_ORDER_VND))
    maximum_discount_vnd = Decimal(str(settings.BIRTHDAY_COUPON_MAX_DISCOUNT_VND))
    if not Decimal('0') < discount_percent <= Decimal('100'):
        raise ValueError('BIRTHDAY_COUPON_DISCOUNT_PERCENT must be between 1 and 100.')
    if minimum_order_vnd < 0:
        raise ValueError('BIRTHDAY_COUPON_MINIMUM_ORDER_VND cannot be negative.')
    if maximum_discount_vnd <= 0:
        raise ValueError('BIRTHDAY_COUPON_MAX_DISCOUNT_VND must be positive.')
    return {
        'description': 'Automatically issued birthday coupon',
        'discount_type': Coupon.DiscountType.PERCENTAGE,
        'discount_value': discount_percent,
        'amount_currency': Coupon.AmountCurrency.VND,
        'minimum_order_amount': minimum_order_vnd,
        'maximum_discount_amount': maximum_discount_vnd,
        'usage_limit': 1,
        'per_user_limit': 1,
        'starts_at': None,
        'expires_at': None,
        'is_active': True,
        'source': Coupon.Source.BIRTHDAY,
    }


def issue_birthday_coupon(user, birthday_year: int):
    existing = Coupon.objects.filter(
        source=Coupon.Source.BIRTHDAY,
        assigned_user=user,
        birthday_year=birthday_year,
    ).first()
    if existing:
        return existing, False

    defaults = _coupon_defaults()
    for _ in range(5):
        code = f'BDAY-{birthday_year}-{user.pk}-{secrets.token_hex(3).upper()}'
        try:
            # Keep the retry recoverable when this function is already running
            # inside the email delivery transaction.
            with transaction.atomic():
                coupon = Coupon.objects.create(
                    code=code,
                    assigned_user=user,
                    birthday_year=birthday_year,
                    **defaults,
                )
        except IntegrityError:
            existing = Coupon.objects.filter(
                source=Coupon.Source.BIRTHDAY,
                assigned_user=user,
                birthday_year=birthday_year,
            ).first()
            if existing:
                return existing, False
            continue
        return coupon, True
    raise RuntimeError('Unable to create a unique birthday coupon code.')


def birthday_coupon_preview():
    return {
        'code': 'BDAY-PREVIEW',
        'discount_percent': Decimal(str(settings.BIRTHDAY_COUPON_DISCOUNT_PERCENT)),
        'minimum_order_vnd': Decimal(str(settings.BIRTHDAY_COUPON_MINIMUM_ORDER_VND)),
        'maximum_discount_vnd': Decimal(str(settings.BIRTHDAY_COUPON_MAX_DISCOUNT_VND)),
    }


def birthday_coupon_email_context(coupon=None):
    if coupon is None:
        return birthday_coupon_preview()
    return {
        'code': coupon.code,
        'discount_percent': coupon.discount_value,
        'minimum_order_vnd': coupon.minimum_order_amount,
        'maximum_discount_vnd': coupon.maximum_discount_amount,
    }
