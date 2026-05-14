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
        total_revenue = Order.objects.aggregate(total=Sum('total_amount'))['total'] or 0
        total_orders = Order.objects.count()
        total_products = Product.objects.count()
        total_customers = User.objects.filter(is_staff=False).count()
        
        # Chart Data (Last 7 days)
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=6)
        
        daily_stats = Order.objects.filter(
            created_at__date__range=[start_date, end_date]
        ).annotate(
            date=TruncDate('created_at')
        ).values('date').annotate(
            sales=Sum('total_amount'),
            orders=Count('id')
        ).order_by('date')
        
        stats_map = {s['date']: s for s in daily_stats}
        chart_data = []
        for i in range(7):
            d = start_date + timedelta(days=i)
            day_stat = stats_map.get(d, {'sales': 0, 'orders': 0})
            chart_data.append({
                'name': d.strftime('%a'),
                'full_date': d.isoformat(),
                'sales': float(day_stat['sales'] or 0),
                'orders': day_stat['orders']
            })

        # Top selling products
        top_selling = Product.objects.all().order_by('-sales')[:5]
        top_selling_serializer = ProductSerializer(top_selling, many=True, context={'request': request})

        # Revenue by category
        categories = Category.objects.annotate(
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
