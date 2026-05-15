from rest_framework import viewsets, views, response, status, permissions
from django.db import transaction
from django.db.models import Sum, Count
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from django.db.models.functions import TruncDate
from shop.models import Product, Order, Category
from .serializers import (
    ProductSerializer, OrderSerializer, UserSerializer, 
    CategorySerializer
)

import logging
logger = logging.getLogger(__name__)

class AdminProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAdminUser]

    def perform_create(self, serializer):
        product_name = serializer.validated_data.get('name')
        logger.info(f"[ADMIN_CREATE] User: {self.request.user} | Product: {product_name}")
        serializer.save()

    def perform_update(self, serializer):
        product_id = serializer.instance.id
        logger.info(f"[ADMIN_UPDATE] User: {self.request.user} | Product ID: {product_id}")
        serializer.save()

    def perform_destroy(self, instance):
        product_id = instance.id
        logger.info(f"[ADMIN_DELETE] User: {self.request.user} | Product ID: {product_id}")
        instance.delete()

class AdminOrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all().order_by('-created_at')
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAdminUser]

    def perform_update(self, serializer):
        instance = serializer.instance
        old_status = instance.status
        new_status = serializer.validated_data.get('status', old_status)
        
        if old_status != new_status:
            logger.info(f"[ORDER_STATUS_CHANGE] Order ID: {instance.id} | {old_status} -> {new_status} | User: {self.request.user}")
            
            with transaction.atomic():
                # If moving TO cancelled status, restore stock
                if new_status == 'cancelled' and old_status != 'cancelled':
                    for item in instance.items.all():
                        if item.product:
                            product = item.product
                            product.stock += item.quantity
                            product.sales -= item.quantity
                            product.save()
                
                # If moving FROM cancelled status back to active, subtract stock again
                elif old_status == 'cancelled' and new_status != 'cancelled':
                    for item in instance.items.all():
                        if item.product:
                            product = item.product
                            # Optional: check stock here? If not enough, maybe we should raise error.
                            # But usually admin knows what they are doing.
                            product.stock -= item.quantity
                            product.sales += item.quantity
                            product.save()

        serializer.save()

class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = super().get_queryset()
        is_staff = self.request.query_params.get('is_staff')
        if is_staff is not None:
            queryset = queryset.filter(is_staff=is_staff.lower() == 'true')
        return queryset

class AdminCategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAdminUser]

class DashboardStatsView(views.APIView):
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
                return response.Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)
        elif specific_date:
            try:
                start_date = end_date = timezone.datetime.strptime(specific_date, '%Y-%m-%d').date()
                days_count = 1
                period = 'day'
            except ValueError:
                return response.Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)
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
                return response.Response({'error': 'Invalid month or year'}, status=status.HTTP_400_BAD_REQUEST)
        elif specific_year:
            try:
                y = int(specific_year)
                start_date = timezone.datetime(y, 1, 1).date()
                end_date = timezone.datetime(y, 12, 31).date()
                days_count = 365
                period = 'year'
            except (ValueError, TypeError):
                return response.Response({'error': 'Invalid year'}, status=status.HTTP_400_BAD_REQUEST)
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
            else: # week
                start_date = end_date - timedelta(days=6)
                days_count = 7

        # Total Revenue (within period)
        period_orders = Order.objects.filter(created_at__date__range=[start_date, end_date])
        total_revenue = period_orders.aggregate(total=Sum('total_amount'))['total'] or 0
        total_orders = period_orders.count()
        total_products = Product.objects.count()
        total_customers = User.objects.filter(is_staff=False, date_joined__date__range=[start_date, end_date]).count()
        
        # Chart Data
        # For year, we group by month
        if period == 'year':
            from django.db.models.functions import TruncMonth
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

        # Top selling products (within period)
        # Assuming we want top selling products of ALL TIME or just this period?
        # Usually dashboard "Top Products" is all time or relative to period.
        # Let's keep it all time for simplicity unless specified.
        top_selling = Product.objects.all().order_by('-sales')[:5]
        top_selling_serializer = ProductSerializer(top_selling, many=True, context={'request': request})

        # Revenue by category (within period)
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
        
        return response.Response({
            'total_revenue': float(total_revenue),
            'total_orders': total_orders,
            'total_products': total_products,
            'total_customers': total_customers,
            'chart_data': chart_data,
            'top_selling_products': top_selling_serializer.data,
            'revenue_by_category': revenue_by_category,
            'recent_orders': recent_orders_serializer.data
        })
