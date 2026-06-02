from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from shop.models import Product, Order, Category, UserProfile
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Sum, Count
from django.utils import timezone
from datetime import timedelta
from django.db.models.functions import TruncDate, TruncMonth
import os
import uuid
from django.core.files.storage import default_storage

from .models import Setting
from .serializers import SettingSerializer, ProductSerializer, OrderSerializer, UserSerializer, CategorySerializer

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
                if new_status == 'cancelled' and old_status != 'cancelled':
                    for item in instance.items.all():
                        if item.product:
                            product = item.product
                            product.stock += item.quantity
                            product.sales -= item.quantity
                            product.save()
                elif old_status == 'cancelled' and new_status != 'cancelled':
                    for item in instance.items.all():
                        if item.product:
                            product = item.product
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
            change = ((current - previous) / previous) * 100
            sign = "+" if change > 0 else ""
            return f"{sign}{change:.1f}%"
            
        revenue_trend = calculate_trend(float(total_revenue), float(prev_total_revenue))
        orders_trend = calculate_trend(total_orders, prev_total_orders)
        customers_trend = calculate_trend(total_customers, prev_total_customers)
        
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

        top_selling = Product.objects.all().order_by('-sales')[:5]
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

    @action(detail=False, methods=['post'], url_path='upload-logo')
    def upload_logo(self, request):
        if 'logo' not in request.FILES:
            return Response(
                {'error': 'No logo file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        logo_file = request.FILES['logo']

        # Validate file type - only SVG allowed
        allowed_types = ['image/svg+xml']
        if logo_file.content_type not in allowed_types:
            return Response(
                {'error': f'Invalid file type. Only SVG files are allowed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file size (max 1MB for SVG)
        max_size = 1 * 1024 * 1024
        if logo_file.size > max_size:
            return Response(
                {'error': 'File too large. Max 1MB'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate unique filename
        ext = os.path.splitext(logo_file.name)[1]
        filename = f'logos/{uuid.uuid4().hex}{ext}'

        # Save file
        try:
            path = default_storage.save(filename, logo_file)
            logo_url = default_storage.url(path)

            # Update setting with logo URL
            setting, created = Setting.objects.get_or_create(
                key='site_logo',
                defaults={'value': logo_url}
            )
            if not created:
                setting.value = logo_url
                setting.save()

            return Response({'url': logo_url, 'path': path})
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
from shop.exchange_rates import get_exchange_rates
from django.utils.text import slugify


class BulkImportProductsView(APIView):
    """
    Import products from Qoo10 scraper CSV.
    
    Pricing formula:
      import_price_vnd = (price_jpy + 1000) * 200
      shipping_vnd = weight_kg * 180000 if weight > 0.5 else 20000
      selling_price_vnd = import_price_vnd * 1.15 + shipping_vnd
      price_usd = selling_price_vnd / usd_to_vnd_rate
    """
    permission_classes = [permissions.IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]

    def _parse_jpy_price(self, price_str):
        """Parse Japanese price string to numeric value."""
        if not price_str:
            return None
        # Remove 円, ¥, commas, spaces
        cleaned = re.sub(r'[円¥,\s\u3000]', '', str(price_str).strip())
        # Extract first number
        match = re.search(r'[\d]+(?:\.[\d]+)?', cleaned)
        if match:
            try:
                return Decimal(match.group())
            except InvalidOperation:
                return None
        return None

    def _calculate_selling_price(self, price_jpy, weight_kg, usd_to_vnd):
        """Calculate selling price using the pricing formula."""
        if price_jpy is None:
            return None
        
        # Import price (VND) = (price_jpy + 1000) * 200
        import_price_vnd = (price_jpy + Decimal('1000')) * Decimal('200')
        
        # Shipping (VND)
        if weight_kg and weight_kg > Decimal('0.5'):
            shipping_vnd = weight_kg * Decimal('180000')
        else:
            shipping_vnd = Decimal('20000')
        
        # Selling price (VND) = import * 1.15 + shipping
        selling_price_vnd = import_price_vnd * Decimal('1.15') + shipping_vnd
        
        # Convert to USD for DB storage
        if usd_to_vnd and usd_to_vnd > 0:
            price_usd = selling_price_vnd / Decimal(str(usd_to_vnd))
        else:
            price_usd = selling_price_vnd / Decimal('25000')
        
        return round(price_usd, 2)

    def _clean_image_url(self, url):
        """Clean image URL, prepending https: if protocol-relative."""
        if not url:
            return ""
        url = url.strip()
        if url.startswith('//'):
            return f"https:{url}"
        return url

    def post(self, request):
        csv_file = request.FILES.get('csv_file')
        if not csv_file:
            return Response(
                {'error': 'No CSV file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file type
        if not csv_file.name.lower().endswith('.csv'):
            return Response(
                {'error': 'File must be a CSV file'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get exchange rates
        rates = get_exchange_rates()
        usd_to_vnd = rates.get('usd_to_vnd', 25000)

        try:
            # Read and decode CSV (handle BOM)
            content = csv_file.read().decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(content))
            
            created = 0
            skipped = 0
            errors = []
            
            for row_num, row in enumerate(reader, start=2):
                try:
                    name = (row.get('Name') or '').strip()
                    if not name:
                        errors.append(f'Row {row_num}: Missing product name')
                        continue
                    
                    # Generate product ID from SKU
                    sku = (row.get('SKU') or '').strip()
                    if sku:
                        product_id = f'QOO-{sku}' if not sku.startswith('QOO-') else sku
                    else:
                        product_id = f'QOO-{uuid.uuid4().hex[:8].upper()}'
                    
                    # Check for duplicate
                    if Product.objects.filter(id=product_id).exists():
                        skipped += 1
                        continue
                    
                    # Parse price (Qoo10 scraper exports the price in 'Original Price' and literal label '販売価格' in 'Price')
                    price_jpy = self._parse_jpy_price(row.get('Original Price') or row.get('Price', ''))
                    
                    # Parse weight from request data (sent alongside CSV)
                    weight_str = row.get('Weight', '').strip()
                    try:
                        weight_kg = Decimal(weight_str) if weight_str else Decimal('0.3')
                    except InvalidOperation:
                        weight_kg = Decimal('0.3')
                    
                    # Calculate selling price
                    price_usd = self._calculate_selling_price(price_jpy, weight_kg, usd_to_vnd)
                    if price_usd is None:
                        price_usd = Decimal('0')
                    
                    # Handle category
                    category = None
                    category_name = (row.get('Category') or '').strip()
                    if category_name:
                        # Try to find by name, or create new
                        category, _ = Category.objects.get_or_create(
                            name=category_name,
                            defaults={'slug': slugify(category_name) or f'cat-{uuid.uuid4().hex[:6]}'}
                        )
                    
                    # Brand: use Brand field, fallback to Seller
                    brand = (row.get('Brand') or row.get('Seller') or '').strip()
                    
                    # Location from Shipping
                    location = (row.get('Shipping') or '').strip()
                    
                    # Main image URL
                    main_image = self._clean_image_url(row.get('Main Image') or '')
                    
                    # URL as description source
                    source_url = (row.get('URL') or '').strip()
                    description = f'Imported from Qoo10: {source_url}' if source_url else 'Imported from Qoo10'
                    
                    # Create product
                    with transaction.atomic():
                        product = Product.objects.create(
                            id=product_id,
                            name=name,
                            price=price_usd,
                            currency='USD',
                            category=category,
                            brand=brand[:100] if brand else '',
                            location=location[:100] if location else '',
                            description=description,
                            stock=1,
                            weight=weight_kg,
                            is_new=True,
                        )
                        
                        # Store main image URL directly
                        if main_image and main_image.startswith('http'):
                            product.image = main_image
                            product.save(update_fields=['image'])
                        
                        # Create gallery images from All Images
                        all_images_str = (row.get('All Images') or '').strip()
                        if all_images_str:
                            image_urls = []
                            for url in all_images_str.split('|'):
                                cleaned_url = self._clean_image_url(url)
                                if cleaned_url.startswith('http'):
                                    image_urls.append(cleaned_url)
                            for idx, img_url in enumerate(image_urls[:10]):  # Max 10 gallery images
                                ProductImage.objects.create(
                                    product=product,
                                    image=img_url,
                                    is_primary=(idx == 0 and not main_image),
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
                'errors': errors[:50],  # Cap at 50 errors
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