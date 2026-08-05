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


class CouponValidateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        code = normalize_coupon_code(request.data.get('code'))
        if not code:
            return Response(
                {'valid': False, 'error_code': 'required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cart = Cart.objects.filter(user=request.user).prefetch_related('items__product').first()
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

        subtotal = sum(
            (item.product.price * item.quantity for item in cart.items.all() if item.product_id),
            Decimal('0.00'),
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
