from decimal import Decimal

from rest_framework import mixins, viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from shop.models import (
    AffiliateCommission,
    AffiliatePayout,
    AffiliateProfile,
    Category,
    ContactInfo,
    ContactMessage,
    Coupon,
    Order,
    PaymentMethodConfig,
    PaymentTransaction,
    Product,
    ProductStatus,
    StorePage,
    UserProfile,
)
from django.contrib.auth.models import User
from django.db import transaction
from django.conf import settings
from django.db.models import Sum, Count
from django.utils import timezone
from datetime import timedelta
from django.db.models.functions import TruncDate, TruncMonth
import uuid
import os
from django.core.files.storage import default_storage

from .models import Setting
from .serializers import (
    AdminContactInfoSerializer,
    AdminContactMessageSerializer,
    AdminStorePageSerializer,
    CategorySerializer,
    CouponSerializer,
    OrderSerializer,
    ProductSerializer,
    SettingSerializer,
    UserSerializer,
    AffiliateCommissionSerializer,
    AffiliatePayoutSerializer,
    AffiliateProfileSerializer,
    PaymentMethodConfigSerializer,
)
from shop.affiliates import refresh_available_commissions, sync_order_commission
from shop.loyalty import sync_order_loyalty_points
from shop.payments import expire_payment, expire_pending_payments, restore_order_inventory
from shop.profit import calculate_gross_profit_metrics, recognized_sales
from shop.birthday_emails import (
    send_birthday_email_for_customer,
    send_birthday_test_email,
)

import logging
logger = logging.getLogger(__name__)

class AdminProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related('category', 'source_info').all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAdminUser]

    def perform_create(self, serializer):
        product_name = serializer.validated_data.get('name')
        logger.info(f"[ADMIN_CREATE] User: {self.request.user} | Product: {product_name}")
        serializer.save()

    def perform_update(self, serializer):
        product_id = serializer.instance.id
        old_status = serializer.instance.status
        logger.info(f"[ADMIN_UPDATE] User: {self.request.user} | Product ID: {product_id}")
        with transaction.atomic():
            product = serializer.save()
            if product.status != old_status:
                from product_sources.services.audit_service import AuditService

                source = getattr(product, 'source_info', None)
                action = {
                    ProductStatus.PUBLISHED: 'product.publish',
                    ProductStatus.SUSPENDED: 'product.suspend',
                }.get(product.status, 'product.status_change')
                AuditService().log(
                    action=action,
                    actor=self.request.user,
                    product_id=product.id,
                    provider=source.provider if source else '',
                    source_product_id=source.source_product_id if source else '',
                    input_summary={'old_status': old_status, 'new_status': product.status},
                    result_summary={'status': product.status},
                )

    def perform_destroy(self, instance):
        product_id = instance.id
        logger.info(f"[ADMIN_DELETE] User: {self.request.user} | Product ID: {product_id}")
        instance.delete()

class AdminOrderViewSet(viewsets.ModelViewSet):
    queryset = (
        Order.objects.select_related('user', 'user__profile', 'payment', 'payment__verified_by')
        .prefetch_related(
            'items__product__category',
            'items__product__source_info',
        )
        .order_by('-created_at')
    )
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAdminUser]

    def list(self, request, *args, **kwargs):
        expire_pending_payments()
        return super().list(request, *args, **kwargs)

    def perform_update(self, serializer):
        instance = serializer.instance
        old_status = instance.status
        new_status = serializer.validated_data.get('status', old_status)

        try:
            payment = instance.payment
        except PaymentTransaction.DoesNotExist:
            payment = None

        if new_status in {'processing', 'shipped', 'delivered'}:
            if (
                payment
                and payment.method == PaymentMethodConfig.Code.BANK_TRANSFER
                and payment.status != PaymentTransaction.Status.PAID
            ):
                raise serializers.ValidationError({
                    'status': 'Bank transfer must be verified before fulfillment.'
                })
        
        if old_status != new_status:
            logger.info(f"[ORDER_STATUS_CHANGE] Order ID: {instance.id} | {old_status} -> {new_status} | User: {self.request.user}")
            with transaction.atomic():
                if new_status == 'cancelled' and old_status != 'cancelled':
                    restore_order_inventory(instance)
                    if payment and payment.status in {
                        PaymentTransaction.Status.PENDING,
                        PaymentTransaction.Status.PROOF_SUBMITTED,
                        PaymentTransaction.Status.COD_PENDING,
                    }:
                        payment.status = PaymentTransaction.Status.FAILED
                        payment.failure_reason = 'Order cancelled by administrator.'
                        payment.verified_at = timezone.now()
                        payment.verified_by = self.request.user
                        payment.save(update_fields=[
                            'status', 'failure_reason', 'verified_at',
                            'verified_by', 'updated_at',
                        ])
                elif old_status == 'cancelled' and new_status != 'cancelled':
                    for item in instance.items.all():
                        if item.product:
                            product = item.product
                            product.stock -= item.quantity
                            product.sales += item.quantity
                            product.save()
                order = serializer.save()
                sync_order_commission(order, old_status)
                sync_order_loyalty_points(order)
            return
        serializer.save()

    @action(detail=True, methods=['post'], url_path='verify-payment')
    def verify_payment(self, request, pk=None):
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=self.get_object().pk)
            try:
                payment = PaymentTransaction.objects.select_for_update().get(order=order)
            except PaymentTransaction.DoesNotExist:
                return Response(
                    {'detail': 'Payment transaction not found.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            expire_payment(payment)
            if payment.method != PaymentMethodConfig.Code.BANK_TRANSFER:
                return Response(
                    {'detail': 'Only bank transfers require verification.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if payment.status not in {
                PaymentTransaction.Status.PENDING,
                PaymentTransaction.Status.PROOF_SUBMITTED,
            }:
                return Response(
                    {'detail': 'This payment cannot be verified.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            now = timezone.now()
            payment.status = PaymentTransaction.Status.PAID
            payment.paid_at = now
            payment.verified_at = now
            payment.verified_by = request.user
            payment.failure_reason = ''
            payment.save(update_fields=[
                'status', 'paid_at', 'verified_at', 'verified_by',
                'failure_reason', 'updated_at',
            ])
            if order.status == 'pending':
                order.status = 'processing'
            if 'admin_notes' in request.data:
                order.admin_notes = str(request.data.get('admin_notes') or '').strip()
            order.save(update_fields=['status', 'admin_notes', 'updated_at'])
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=['post'], url_path='reject-payment')
    def reject_payment(self, request, pk=None):
        reason = str(request.data.get('reason') or '').strip()
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=self.get_object().pk)
            try:
                payment = PaymentTransaction.objects.select_for_update().get(order=order)
            except PaymentTransaction.DoesNotExist:
                return Response(
                    {'detail': 'Payment transaction not found.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if payment.status not in {
                PaymentTransaction.Status.PENDING,
                PaymentTransaction.Status.PROOF_SUBMITTED,
            }:
                return Response(
                    {'detail': 'This payment cannot be rejected.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            old_status = order.status
            payment.status = PaymentTransaction.Status.FAILED
            payment.failure_reason = reason or 'Payment proof was rejected.'
            payment.verified_at = timezone.now()
            payment.verified_by = request.user
            payment.save(update_fields=[
                'status', 'failure_reason', 'verified_at', 'verified_by', 'updated_at'
            ])
            if order.status != 'cancelled':
                restore_order_inventory(order)
                order.status = 'cancelled'
                order.admin_notes = str(request.data.get('admin_notes') or order.admin_notes or '').strip()
                order.save(update_fields=['status', 'admin_notes', 'updated_at'])
                sync_order_commission(order, old_status)
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=['post'], url_path='mark-cod-collected')
    def mark_cod_collected(self, request, pk=None):
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=self.get_object().pk)
            try:
                payment = PaymentTransaction.objects.select_for_update().get(order=order)
            except PaymentTransaction.DoesNotExist:
                return Response(
                    {'detail': 'Payment transaction not found.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if payment.status != PaymentTransaction.Status.COD_PENDING:
                return Response(
                    {'detail': 'COD payment is not awaiting collection.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            now = timezone.now()
            payment.status = PaymentTransaction.Status.COD_COLLECTED
            payment.paid_at = now
            payment.verified_at = now
            payment.verified_by = request.user
            payment.save(update_fields=[
                'status', 'paid_at', 'verified_at', 'verified_by', 'updated_at'
            ])
        return Response(self.get_serializer(order).data)

class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related('profile').all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = super().get_queryset()
        is_staff = self.request.query_params.get('is_staff')
        if is_staff is not None:
            queryset = queryset.filter(is_staff=is_staff.lower() == 'true')
        return queryset

    @action(detail=True, methods=['post'], url_path='send-birthday-email-test')
    def send_birthday_email_test(self, request, pk=None):
        customer = self.get_object()
        recipient_email = str(request.data.get('email') or request.user.email or '').strip()
        if not recipient_email or '@' not in recipient_email:
            return Response(
                {'detail': 'The administrator account needs a valid email address.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            sent_to = send_birthday_test_email(
                customer,
                recipient_email,
                language=request.data.get('language'),
            )
        except Exception:
            logger.exception(
                'Birthday test email failed for customer_id=%s', customer.pk
            )
            return Response(
                {'detail': 'Unable to send the birthday test email.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({'sent_to': sent_to})

    @action(detail=True, methods=['post'], url_path='send-birthday-email')
    def send_birthday_email(self, request, pk=None):
        customer = self.get_object()
        from zoneinfo import ZoneInfo

        run_date = timezone.localdate(
            timezone=ZoneInfo(settings.BIRTHDAY_EMAIL_TIME_ZONE)
        )
        result = send_birthday_email_for_customer(customer, run_date)
        result_status = result['status']
        if result_status in {'sent', 'already_sent'}:
            return Response(result)

        response_status = (
            status.HTTP_502_BAD_GATEWAY
            if result_status == 'failed'
            else status.HTTP_400_BAD_REQUEST
        )
        messages = {
            'not_birthday': 'Today is not this customer\'s birthday.',
            'missing_birthday': 'This customer does not have a date of birth.',
            'missing_email': 'This customer does not have an email address.',
            'disabled': 'This customer has disabled birthday email.',
            'suppressed': 'This customer has unsubscribed from marketing email.',
            'ineligible': 'This account is not eligible for customer birthday email.',
            'failed': 'Unable to send the birthday email.',
        }
        return Response(
            {
                'error_code': result_status,
                'detail': messages.get(result_status, 'Unable to send the birthday email.'),
            },
            status=response_status,
        )


class AdminPaymentMethodViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = PaymentMethodConfig.objects.all()
    serializer_class = PaymentMethodConfigSerializer
    permission_classes = [permissions.IsAdminUser]

    def list(self, request, *args, **kwargs):
        expire_pending_payments()
        return super().list(request, *args, **kwargs)

class AdminCategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.annotate(product_count=Count('products')).all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAdminUser]


class AdminCouponViewSet(viewsets.ModelViewSet):
    queryset = Coupon.objects.select_related('created_by', 'affiliate').all().order_by('-created_at')
    serializer_class = CouponSerializer
    permission_classes = [permissions.IsAdminUser]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        coupon = self.get_object()
        if coupon.used_count or coupon.redemptions.exists():
            return Response(
                {'detail': 'Used coupons cannot be deleted. Disable this coupon instead.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class AdminAffiliateViewSet(viewsets.ModelViewSet):
    queryset = (
        AffiliateProfile.objects.select_related('user', 'user__profile', 'created_by')
        .prefetch_related('visits', 'commissions')
        .all()
    )
    serializer_class = AffiliateProfileSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        refresh_available_commissions()
        return super().get_queryset()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        affiliate = self.get_object()
        if affiliate.commissions.exists() or affiliate.coupons.exists():
            return Response(
                {'detail': 'Affiliate history must be retained. Suspend this account instead.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class AdminAffiliateCommissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        AffiliateCommission.objects.select_related('affiliate', 'order', 'order__user', 'payout')
        .all()
    )
    serializer_class = AffiliateCommissionSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        refresh_available_commissions()
        queryset = super().get_queryset()
        status_code = self.request.query_params.get('status')
        affiliate_id = self.request.query_params.get('affiliate')
        if status_code:
            queryset = queryset.filter(status=status_code)
        if affiliate_id:
            queryset = queryset.filter(affiliate_id=affiliate_id)
        return queryset


class AdminAffiliatePayoutViewSet(viewsets.ModelViewSet):
    queryset = (
        AffiliatePayout.objects.select_related('affiliate', 'created_by')
        .prefetch_related('commissions')
        .all()
    )
    serializer_class = AffiliatePayoutSerializer
    permission_classes = [permissions.IsAdminUser]
    http_method_names = ['get', 'post', 'head', 'options']

    def create(self, request, *args, **kwargs):
        return Response(
            {'detail': 'Use create-from-available to create a payout.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    @action(detail=False, methods=['post'], url_path='create-from-available')
    def create_from_available(self, request):
        affiliate_id = request.data.get('affiliate')
        if not affiliate_id:
            return Response({'affiliate': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)
        refresh_available_commissions()
        with transaction.atomic():
            try:
                affiliate = AffiliateProfile.objects.select_for_update().get(pk=affiliate_id)
            except AffiliateProfile.DoesNotExist:
                return Response({'affiliate': ['Affiliate not found.']}, status=status.HTTP_404_NOT_FOUND)
            if not affiliate.payout_details_encrypted:
                return Response(
                    {'detail': 'Configure affiliate bank details before creating a payout.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            commissions = list(
                AffiliateCommission.objects.select_for_update().filter(
                    affiliate=affiliate,
                    status=AffiliateCommission.Status.AVAILABLE,
                    payout__isnull=True,
                )
            )
            if not commissions:
                return Response(
                    {'detail': 'No available commissions for this affiliate.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            total = sum((item.amount for item in commissions), Decimal('0.00'))
            minimum = Decimal(str(getattr(settings, 'AFFILIATE_MIN_PAYOUT_USD', '20.00')))
            if total < minimum:
                return Response(
                    {'detail': f'Minimum payout is {minimum} USD.', 'available_amount': total},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            payout = AffiliatePayout.objects.create(
                affiliate=affiliate,
                total_amount=total,
                payout_details_encrypted=affiliate.payout_details_encrypted,
                notes=str(request.data.get('notes') or '').strip(),
                created_by=request.user,
            )
            AffiliateCommission.objects.filter(pk__in=[item.pk for item in commissions]).update(
                payout=payout
            )
        return Response(self.get_serializer(payout).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        reference = str(request.data.get('transaction_reference') or '').strip()
        if not reference:
            return Response(
                {'transaction_reference': ['This field is required.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            payout = AffiliatePayout.objects.select_for_update().get(pk=self.get_object().pk)
            if payout.status != AffiliatePayout.Status.DRAFT:
                return Response(
                    {'detail': 'Only draft payouts can be marked paid.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            now = timezone.now()
            payout.status = AffiliatePayout.Status.PAID
            payout.transaction_reference = reference
            payout.paid_at = now
            payout.save(update_fields=['status', 'transaction_reference', 'paid_at', 'updated_at'])
            payout.commissions.update(
                status=AffiliateCommission.Status.PAID,
                paid_at=now,
                updated_at=now,
            )
        return Response(self.get_serializer(payout).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        with transaction.atomic():
            payout = AffiliatePayout.objects.select_for_update().get(pk=self.get_object().pk)
            if payout.status != AffiliatePayout.Status.DRAFT:
                return Response(
                    {'detail': 'Only draft payouts can be cancelled.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            payout.commissions.update(payout=None)
            payout.status = AffiliatePayout.Status.CANCELLED
            payout.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(payout).data)


class AdminStorePageViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = StorePage.objects.select_related('updated_by').all()
    serializer_class = AdminStorePageSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = 'slug'
    http_method_names = ['get', 'put', 'patch', 'head', 'options']

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class AdminContactInfoView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get_object(self):
        contact_info = ContactInfo.objects.order_by('id').first()
        if contact_info is None:
            contact_info = ContactInfo.objects.create()
        return contact_info

    def get(self, request):
        return Response(AdminContactInfoSerializer(self.get_object()).data)

    def put(self, request):
        serializer = AdminContactInfoSerializer(self.get_object(), data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def patch(self, request):
        serializer = AdminContactInfoSerializer(
            self.get_object(), data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AdminContactMessageViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = ContactMessage.objects.all()
    serializer_class = AdminContactMessageSerializer
    permission_classes = [permissions.IsAdminUser]
    http_method_names = ['get', 'patch', 'head', 'options']

class DashboardStatsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        period = request.query_params.get('period', 'week')
        specific_date = request.query_params.get('date')
        specific_month = request.query_params.get('month')
        specific_year = request.query_params.get('year')
        start_date_param = request.query_params.get('start_date')
        end_date_param = request.query_params.get('end_date')
        
        now = timezone.now()
        end_date = now.date()
        
        if start_date_param and end_date_param:
            try:
                start_date = timezone.datetime.strptime(start_date_param, '%Y-%m-%d').date()
                end_date = timezone.datetime.strptime(end_date_param, '%Y-%m-%d').date()
                days_count = (end_date - start_date).days + 1
                period = 'custom'
            except ValueError:
                return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)
        elif specific_date:
            try:
                start_date = end_date = timezone.datetime.strptime(specific_date, '%Y-%m-%d').date()
                days_count = 1
                period = 'day'
            except ValueError:
                return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)
        elif specific_month and specific_year:
            try:
                m = int(specific_month)
                y = int(specific_year)
                import calendar
                start_date = timezone.datetime(y, m, 1).date()
                last_day = calendar.monthrange(y, m)[1]
                end_date = timezone.datetime(y, m, last_day).date()
                days_count = last_day
                period = 'month'
            except (ValueError, TypeError):
                return Response({'error': 'Invalid month or year'}, status=status.HTTP_400_BAD_REQUEST)
        elif specific_year:
            try:
                y = int(specific_year)
                start_date = timezone.datetime(y, 1, 1).date()
                end_date = timezone.datetime(y, 12, 31).date()
                days_count = 365
                period = 'year'
            except (ValueError, TypeError):
                return Response({'error': 'Invalid year'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            if period == 'day':
                start_date = end_date
                days_count = 1
            elif period == 'month':
                start_date = end_date - timedelta(days=29)
                days_count = 30
            elif period == 'year':
                start_date = end_date - timedelta(days=364)
                days_count = 365
            else:  # week
                start_date = end_date - timedelta(days=6)
                days_count = 7

        period_orders = Order.objects.filter(created_at__date__range=[start_date, end_date])
        total_revenue = period_orders.aggregate(total=Sum('total_amount'))['total'] or 0
        total_orders = period_orders.count()
        total_products = Product.objects.count()
        total_customers = User.objects.filter(is_staff=False, date_joined__date__range=[start_date, end_date]).count()
        
        prev_start_date = start_date - timedelta(days=days_count)
        prev_end_date = end_date - timedelta(days=days_count)
        
        prev_period_orders = Order.objects.filter(created_at__date__range=[prev_start_date, prev_end_date])
        prev_total_revenue = prev_period_orders.aggregate(total=Sum('total_amount'))['total'] or 0
        prev_total_orders = prev_period_orders.count()
        prev_total_customers = User.objects.filter(is_staff=False, date_joined__date__range=[prev_start_date, prev_end_date]).count()
        
        def calculate_trend(current, previous):
            if previous == 0:
                if current > 0:
                    return "+100.0%"
                return "0.0%"
            change = ((current - previous) / abs(previous)) * 100
            sign = "+" if change > 0 else ""
            return f"{sign}{change:.1f}%"
            
        revenue_trend = calculate_trend(float(total_revenue), float(prev_total_revenue))
        orders_trend = calculate_trend(total_orders, prev_total_orders)
        customers_trend = calculate_trend(total_customers, prev_total_customers)

        recognized_period_orders = recognized_sales(period_orders).select_related(
            'payment'
        ).prefetch_related('items__product')
        recognized_prev_orders = recognized_sales(prev_period_orders).select_related(
            'payment'
        ).prefetch_related('items__product')
        profit_metrics = calculate_gross_profit_metrics(recognized_period_orders)
        previous_profit_metrics = calculate_gross_profit_metrics(recognized_prev_orders)
        gross_profit_trend = calculate_trend(
            float(profit_metrics['estimated_gross_profit']),
            float(previous_profit_metrics['estimated_gross_profit']),
        )
        
        if period == 'year':
            monthly_stats = period_orders.annotate(
                month=TruncMonth('created_at')
            ).values('month').annotate(
                sales=Sum('total_amount'),
                orders=Count('id')
            ).order_by('month')
            
            stats_map = {s['month'].date().replace(day=1): s for s in monthly_stats}
            chart_data = []
            curr_month = end_date.month
            curr_year = end_date.year
            for i in range(11, -1, -1):
                m = curr_month - i
                y = curr_year
                while m <= 0:
                    m += 12
                    y -= 1
                m_date = end_date.replace(year=y, month=m, day=1)
                day_stat = stats_map.get(m_date, {'sales': 0, 'orders': 0})
                chart_data.append({
                    'name': m_date.strftime('%b'),
                    'full_date': m_date.isoformat(),
                    'sales': float(day_stat['sales'] or 0),
                    'orders': day_stat['orders']
                })
        else:
            daily_stats = period_orders.annotate(
                date=TruncDate('created_at')
            ).values('date').annotate(
                sales=Sum('total_amount'),
                orders=Count('id')
            ).order_by('date')
            
            stats_map = {s['date']: s for s in daily_stats}
            chart_data = []
            for i in range(days_count):
                d = start_date + timedelta(days=i)
                day_stat = stats_map.get(d, {'sales': 0, 'orders': 0})
                chart_data.append({
                    'name': d.strftime('%d %b') if period == 'month' else d.strftime('%a'),
                    'full_date': d.isoformat(),
                    'sales': float(day_stat['sales'] or 0),
                    'orders': day_stat['orders']
                })

        top_selling = Product.objects.select_related('category', 'source_info').order_by('-sales')[:5]
        top_selling_serializer = ProductSerializer(top_selling, many=True, context={'request': request})

        categories = Category.objects.filter(
            products__orderitem__order__created_at__date__range=[start_date, end_date]
        ).annotate(
            revenue=Sum('products__orderitem__price')
        ).values('name', 'revenue').order_by('-revenue')
        
        revenue_by_category = [
            {'name': c['name'], 'value': float(c['revenue'] or 0)}
            for c in categories if c['revenue']
        ]

        recent_orders = Order.objects.all().order_by('-created_at')[:5]
        recent_orders_serializer = OrderSerializer(recent_orders, many=True)
        
        return Response({
            'total_revenue': float(total_revenue),
            'revenue_trend': revenue_trend,
            'total_orders': total_orders,
            'orders_trend': orders_trend,
            'total_products': total_products,
            'total_customers': total_customers,
            'customers_trend': customers_trend,
            'estimated_gross_profit': float(profit_metrics['estimated_gross_profit']),
            'gross_profit_trend': gross_profit_trend,
            'cost_of_goods_sold': float(profit_metrics['cost_of_goods_sold']),
            'covered_product_revenue': float(profit_metrics['covered_product_revenue']),
            'profit_margin_percent': float(profit_metrics['profit_margin_percent']),
            'profit_coverage_percent': float(profit_metrics['profit_coverage_percent']),
            'chart_data': chart_data,
            'top_selling_products': top_selling_serializer.data,
            'revenue_by_category': revenue_by_category,
            'recent_orders': recent_orders_serializer.data
        })

class SettingViewSet(viewsets.ModelViewSet):
    queryset = Setting.objects.all()
    serializer_class = SettingSerializer
    permission_classes = [permissions.IsAdminUser]

    def create(self, request, *args, **kwargs):
        key = request.data.get('key')
        if Setting.objects.filter(key=key).exists():
            return Response(
                {'error': f'Setting with key "{key}" already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        if 'key' in request.data:
            return Response(
                {'error': 'Key cannot be changed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    def perform_update(self, serializer):
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        protected_keys = ['SYSTEM_CONFIG', 'MAINTENANCE_MODE']
        if instance.key in protected_keys:
            return Response(
                {'error': f'Cannot delete protected setting: {instance.key}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], url_path='upload-login-background',
            parser_classes=[MultiPartParser, FormParser])
    def upload_login_background(self, request):
        if 'image' not in request.FILES:
            return Response(
                {'error': 'No image file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        image_file = request.FILES['image']
        allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        if image_file.content_type not in allowed_types:
            return Response(
                {'error': 'Invalid file type. Allowed: JPEG, PNG, WEBP, GIF'},
                status=status.HTTP_400_BAD_REQUEST
            )

        max_size = 5 * 1024 * 1024
        if image_file.size > max_size:
            return Response(
                {'error': 'File too large. Max 5MB'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ext = os.path.splitext(image_file.name)[1]
        filename = f'system_images/login_background/{uuid.uuid4().hex}{ext}'

        try:
            path = default_storage.save(filename, image_file)
            image_url = default_storage.url(path)

            setting, created = Setting.objects.get_or_create(
                key='login_background_image',
                defaults={'value': image_url}
            )
            if not created:
                setting.value = image_url
                setting.save()

            return Response({'url': image_url})
        except Exception as e:
            return Response(
                {'error': f'Failed to save file: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='upload-home-hero-image',
            parser_classes=[MultiPartParser, FormParser])
    def upload_home_hero_image(self, request):
        if 'image' not in request.FILES:
            return Response(
                {'error': 'No image file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        image_file = request.FILES['image']
        allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        if image_file.content_type not in allowed_types:
            return Response(
                {'error': 'Invalid file type. Allowed: JPEG, PNG, WEBP, GIF'},
                status=status.HTTP_400_BAD_REQUEST
            )

        max_size = 5 * 1024 * 1024
        if image_file.size > max_size:
            return Response(
                {'error': 'File too large. Max 5MB'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ext = os.path.splitext(image_file.name)[1]
        filename = f'system_images/home_hero/{uuid.uuid4().hex}{ext}'

        try:
            path = default_storage.save(filename, image_file)
            image_url = default_storage.url(path)

            setting, created = Setting.objects.get_or_create(
                key='home_hero_image',
                defaults={'value': image_url}
            )
            if not created:
                setting.value = image_url
                setting.save()

            return Response({'url': image_url})
        except Exception as e:
            return Response(
                {'error': f'Failed to save file: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )



import csv
import io
import re
from decimal import Decimal, InvalidOperation
from shop.models import ProductImage
from django.utils.text import slugify


class BulkImportProductsView(APIView):
    """
    Import products from Qoo10 scraper CSV or source URL.
    """
    permission_classes = [permissions.IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]

    def _parse_jpy_price(self, price_str):
        """Parse Japanese price string to numeric value."""
        if not price_str:
            return None
        cleaned = re.sub(r'[円¥,\s\u3000]', '', str(price_str).strip())
        match = re.search(r'[\d]+(?:\.[\d]+)?', cleaned)
        if match:
            try:
                return Decimal(match.group())
            except InvalidOperation:
                return None
        return None

    def post(self, request):
        csv_file = request.FILES.get('csv_file')
        if not csv_file:
            return Response(
                {'error': 'No CSV file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not csv_file.name.lower().endswith('.csv'):
            return Response(
                {'error': 'File must be a CSV file'},
                status=status.HTTP_400_BAD_REQUEST
            )

        usd_to_vnd = Decimal(str(settings.USD_VND_RATE))

        from product_sources.services.import_service import SourceImportService
        from product_sources.services.pricing_service import ProductPricingService
        from product_sources.schemas.import_request import ImportSourceProductRequest
        from product_sources.enums import ImageMode
        from product_sources.exceptions import UnsupportedProviderError
        from product_sources.providers import build_provider_registry

        import_service = SourceImportService()
        pricing_service = ProductPricingService()
        provider_registry = build_provider_registry()
        from product_sources.services.audit_service import AuditService
        audit_service = AuditService()

        try:
            content = csv_file.read().decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(content))
            
            created = 0
            skipped = 0
            errors = []
            
            for row_num, row in enumerate(reader, start=2):
                try:
                    url = (row.get('url') or row.get('URL') or '').strip()
                    category_id_val = (row.get('category_id') or row.get('Category_ID') or '').strip()
                    category_id = int(category_id_val) if category_id_val else None
                    category_name = (row.get('category') or row.get('Category') or '').strip()
                    if category_id is None and category_name:
                        matched_category = Category.objects.filter(
                            name__iexact=category_name,
                        ).first()
                        if matched_category:
                            category_id = matched_category.id

                    # If URL points to a supported provider (Amazon JP or Qoo10 JP), import via service
                    is_supported_provider_url = False
                    if url:
                        try:
                            provider_registry.resolve_by_url(url)
                            is_supported_provider_url = True
                        except UnsupportedProviderError:
                            pass

                    if is_supported_provider_url:
                        weight_str = (row.get('weight') or row.get('Weight') or '').strip()
                        try:
                            weight_kg = Decimal(weight_str) if weight_str else Decimal('0.3')
                        except InvalidOperation:
                            weight_kg = Decimal('0.3')

                        stock_str = (row.get('stock') or row.get('Stock') or '').strip()
                        try:
                            default_stock = max(0, int(stock_str)) if stock_str else 1
                        except ValueError:
                            default_stock = 1

                        single_request = ImportSourceProductRequest(
                            url=url,
                            category_id=category_id,
                            default_weight_kg=weight_kg,
                            default_stock=default_stock,
                            image_mode=ImageMode.REMOTE,
                            dry_run=False,
                        )
                        import_service.import_product(single_request, request.user)
                        created += 1
                        continue

                    # Fallback to manual CSV import logic
                    name = (row.get('name') or row.get('Name') or '').strip()
                    if not name:
                        errors.append(f'Row {row_num}: Missing product name')
                        continue

                    sku = (row.get('sku') or row.get('SKU') or '').strip()
                    if sku:
                        product_id = f'QOO-{sku}' if not sku.startswith('QOO-') else sku
                    else:
                        product_id = f'QOO-{uuid.uuid4().hex[:8].upper()}'

                    if Product.objects.filter(id=product_id).exists():
                        skipped += 1
                        continue
                    
                    price_jpy = self._parse_jpy_price(
                        row.get('originalPrice') or row.get('Original Price') or 
                        row.get('price') or row.get('Price', '')
                    )
                    
                    weight_str = (row.get('weight') or row.get('Weight') or '').strip()
                    try:
                        weight_kg = Decimal(weight_str) if weight_str else Decimal('0.3')
                    except InvalidOperation:
                        weight_kg = Decimal('0.3')
                    
                    # Calculate price using shared Pricing Service
                    price_usd = Decimal('0')
                    cost_price_vnd = None
                    if price_jpy is not None:
                        calc_res = pricing_service.calculate(
                            source_price_jpy=price_jpy,
                            weight_kg=weight_kg,
                            usd_vnd_rate=usd_to_vnd
                        )
                        price_usd = calc_res.selling_price_usd
                        cost_price_vnd = (
                            calc_res.import_cost_vnd + calc_res.shipping_vnd
                        )

                    # Handle category
                    category = None

                    if category_id:
                        category = Category.objects.filter(pk=category_id).first()
                        if category is None:
                            errors.append(f'Row {row_num}: Category id={category_id} does not exist.')
                            continue

                    if not category and category_name:
                        category = Category.objects.filter(name__iexact=category_name).first()
                        if not category:
                            allow_auto = getattr(settings, 'ALLOW_AUTO_CREATE_CATEGORY', False)
                            if allow_auto:
                                base_slug = slugify(category_name) or 'category'
                                slug = base_slug
                                counter = 1
                                while Category.objects.filter(slug=slug).exists():
                                    slug = f"{base_slug}-{counter}"
                                    counter += 1
                                category = Category.objects.create(name=category_name, slug=slug)
                            else:
                                errors.append(f'Row {row_num}: Category "{category_name}" does not exist and auto-creation is disabled.')
                                continue

                    if category is None:
                        errors.append(f'Row {row_num}: Category is required.')
                        continue

                    brand = (row.get('brand') or row.get('Brand') or row.get('seller') or row.get('Seller') or '').strip()
                    location = (row.get('shipping') or row.get('Shipping') or '').strip()
                    main_image = (
                        row.get('mainImage') or row.get('image') or row.get('Main Image') or ''
                    ).strip()
                    if main_image.startswith('//'):
                        main_image = f"https:{main_image}"

                    stock_str = (row.get('stock') or row.get('Stock') or '').strip()
                    try:
                        stock = max(0, int(stock_str)) if stock_str else 1
                    except ValueError:
                        stock = 1

                    description = f'Imported from Qoo10: {url}' if url else 'Imported from Qoo10'
                    
                    with transaction.atomic():
                        product = Product.objects.create(
                            id=product_id,
                            name=name,
                            price=price_usd,
                            cost_price_vnd=cost_price_vnd,
                            currency='USD',
                            category=category,
                            brand=brand[:100] if brand else '',
                            location=location[:100] if location else '',
                            description=description,
                            stock=stock,
                            weight=weight_kg,
                            status=ProductStatus.DRAFT,
                            is_new=True,
                        )
                        
                        if main_image and main_image.startswith('http'):
                            product.image = main_image
                            product.save(update_fields=['image'])
                        
                        all_images_str = (row.get('All Images') or row.get('images') or '').strip()
                        if all_images_str:
                            image_urls = []
                            for u in all_images_str.split('|'):
                                u = u.strip()
                                if u.startswith('//'):
                                    u = f"https:{u}"
                                if u.startswith('http'):
                                    image_urls.append(u)
                            for idx, img_url in enumerate(image_urls[:10]):
                                ProductImage.objects.create(
                                    product=product,
                                    image=img_url,
                                    is_primary=(idx == 0 and not main_image),
                                )

                        audit_service.log(
                            action='product_source.import_manual_csv',
                            actor=request.user,
                            product_id=product.id,
                            provider='manual',
                            source_product_id=sku,
                            input_summary={'row': row_num, 'sku': sku},
                            result_summary={'product_id': product.id, 'status': product.status},
                        )
                    
                    created += 1
                    
                except Exception as e:
                    errors.append(f'Row {row_num}: {str(e)}')
                    continue
            
            logger.info(
                f"[CSV_IMPORT] User: {request.user} | Created: {created} | Skipped: {skipped} | Errors: {len(errors)}"
            )
            
            return Response({
                'created': created,
                'skipped': skipped,
                'errors': errors[:50],
                'total_rows': created + skipped + len(errors),
            })
            
        except UnicodeDecodeError:
            return Response(
                {'error': 'Invalid file encoding. Please use UTF-8.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"[CSV_IMPORT_ERROR] {str(e)}")
            return Response(
                {'error': f'Import failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def delete(self, request):
        delete_all = request.query_params.get('all') == 'true'
        if delete_all:
            deleted_count, _ = Product.objects.all().delete()
            message = f'Deleted {deleted_count} products successfully.'
        else:
            deleted_count, _ = Product.objects.filter(id__startswith='QOO-').delete()
            message = f'Deleted {deleted_count} Qoo10 products successfully.'
            
        return Response({
            'message': message,
            'deleted_count': deleted_count
        })
