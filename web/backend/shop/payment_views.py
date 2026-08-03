from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Order, PaymentMethodConfig, PaymentTransaction
from .payments import expire_payment, expire_pending_payments
from .serializers import (
    PaymentMethodPublicSerializer,
    PaymentProofUploadSerializer,
    PaymentTransactionPublicSerializer,
)


class PublicPaymentMethodsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        methods = PaymentMethodConfig.objects.filter(enabled=True)
        return Response(
            PaymentMethodPublicSerializer(
                methods, many=True, context={'request': request}
            ).data
        )


class PaymentProofUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, order_id):
        serializer = PaymentProofUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            try:
                order = Order.objects.select_for_update().get(
                    pk=order_id, user=request.user
                )
                payment = PaymentTransaction.objects.select_for_update().get(order=order)
            except (Order.DoesNotExist, PaymentTransaction.DoesNotExist):
                return Response(status=status.HTTP_404_NOT_FOUND)

            expire_payment(payment)
            if payment.method != PaymentMethodConfig.Code.BANK_TRANSFER:
                return Response(
                    {'detail': 'Payment proof is only supported for bank transfer.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if payment.status not in {
                PaymentTransaction.Status.PENDING,
                PaymentTransaction.Status.PROOF_SUBMITTED,
            }:
                return Response(
                    {'detail': 'This payment can no longer accept a receipt.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            payment.receipt = serializer.validated_data['receipt']
            payment.status = PaymentTransaction.Status.PROOF_SUBMITTED
            payment.proof_submitted_at = timezone.now()
            payment.failure_reason = ''
            payment.save(update_fields=[
                'receipt', 'status', 'proof_submitted_at', 'failure_reason', 'updated_at'
            ])

        return Response(
            PaymentTransactionPublicSerializer(
                payment, context={'request': request}
            ).data
        )
