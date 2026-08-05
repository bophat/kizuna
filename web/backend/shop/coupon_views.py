from decimal import Decimal

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .coupons import (
    CouponValidationError,
    amount_to_base_currency,
    coupon_payload,
    normalize_coupon_code,
    validate_coupon,
)
from .models import Cart, Coupon


def _cart_subtotal(user):
    cart = Cart.objects.filter(user=user).prefetch_related('items__product').first()
    if not cart:
        return None, Decimal('0.00')
    subtotal = sum(
        (
            item.product.price * item.quantity
            for item in cart.items.all()
            if item.product_id
        ),
        Decimal('0.00'),
    )
    return cart, subtotal


class OwnedCouponListView(APIView):
    """List personal coupons that still belong to the authenticated customer."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        include_history = str(request.query_params.get('include_history', '')).lower() in {
            '1', 'true', 'yes',
        }
        _, subtotal = _cart_subtotal(request.user)
        results = []
        coupons = (
            Coupon.objects.filter(assigned_user=request.user)
            .prefetch_related('redemptions')
            .order_by('-created_at')
        )
        for coupon in coupons:
            error_code = None
            try:
                discount = validate_coupon(coupon, request.user, subtotal)
            except CouponValidationError as exc:
                error_code = exc.code
                # A coupon below the current minimum still belongs to the customer
                # and should be visible. Coupons that can never be selected now are
                # omitted from the checkout picker, but remain available in the
                # customer's coupon-wallet history.
                if exc.code != 'minimum_order_not_met' and not include_history:
                    continue
                data = {
                    'valid': False,
                    'code': coupon.code,
                    'discount_type': coupon.discount_type,
                    'discount_value': coupon.discount_value,
                    'amount_currency': coupon.amount_currency,
                    'minimum_order_amount': amount_to_base_currency(
                        coupon, coupon.minimum_order_amount
                    ),
                    'maximum_discount_amount': (
                        amount_to_base_currency(
                            coupon, coupon.maximum_discount_amount
                        )
                        if coupon.maximum_discount_amount is not None
                        else None
                    ),
                    'subtotal_amount': subtotal,
                    'discount_amount': Decimal('0.00'),
                    'total_after_discount': subtotal,
                    'error_code': exc.code,
                }
            else:
                data = coupon_payload(coupon, subtotal, discount)
                data['error_code'] = None
            ownership_status = {
                'inactive': 'inactive',
                'not_started': 'scheduled',
                'expired': 'expired',
                'usage_limit_reached': 'used',
                'per_user_limit_reached': 'used',
            }.get(error_code, 'available')
            customer_redemptions = [
                redemption
                for redemption in coupon.redemptions.all()
                if redemption.user_id == request.user.id
            ]
            data.update(
                {
                    'is_applicable': bool(data['valid']),
                    'discount_value_base': (
                        amount_to_base_currency(coupon, coupon.discount_value)
                        if coupon.discount_type == Coupon.DiscountType.FIXED
                        else coupon.discount_value
                    ),
                    'source': coupon.source,
                    'birthday_year': coupon.birthday_year,
                    'ownership_status': ownership_status,
                    'created_at': coupon.created_at,
                    'expires_at': coupon.expires_at,
                    'redeemed_at': (
                        max(item.created_at for item in customer_redemptions)
                        if customer_redemptions
                        else None
                    ),
                }
            )
            results.append(data)
        return Response({'count': len(results), 'results': results})


class CouponValidateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        code = normalize_coupon_code(request.data.get('code'))
        if not code:
            return Response(
                {'valid': False, 'error_code': 'required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cart, subtotal = _cart_subtotal(request.user)
        if not cart or not cart.items.exists():
            return Response(
                {'valid': False, 'error_code': 'empty_cart'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            coupon = Coupon.objects.get(code=code)
        except Coupon.DoesNotExist:
            return Response(
                {'valid': False, 'error_code': 'invalid'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            discount = validate_coupon(coupon, request.user, subtotal)
        except CouponValidationError as exc:
            return Response(
                {
                    'valid': False,
                    'error_code': exc.code,
                    'minimum_order_amount': amount_to_base_currency(
                        coupon, coupon.minimum_order_amount
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(coupon_payload(coupon, subtotal, discount))
