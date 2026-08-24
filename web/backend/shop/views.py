import mimetypes
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.core.cache import cache
from django.core.files.storage import default_storage
from django.http import FileResponse, Http404
from rest_framework import viewsets, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .exchange_rates import get_exchange_rates
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Avg, Case, Count, IntegerField, Max, Min, Q, Value, When
from .models import (
    AffiliateProfile, Cart, CartItem, Coupon, CouponRedemption, Order,
    OrderItem, PaymentMethodConfig, UserProfile, Product, ProductStatus,
    Category, Favorite, ProductReview, CustomerNotification,
)
from .serializers import (
    CartSerializer, OrderSerializer, UserSerializer, PublicProductSerializer,
    CategorySerializer, FavoriteSerializer, PaymentTransactionPublicSerializer,
    UserProfileSerializer, ProductReviewSerializer, ProductReviewWriteSerializer,
    CustomerNotificationSerializer,
)
from .coupons import CouponValidationError, normalize_coupon_code, validate_coupon
from .shipping import calculate_shipping_amount
from .affiliates import (
    create_order_commission,
    normalize_affiliate_code,
    resolve_active_affiliate,
)
from .payments import (
    create_payment_transaction,
    enabled_payment_method,
    expire_pending_payments,
    normalize_payment_method,
)
from .invoice import generate_invoice_pdf, generate_invoice_filename
from .guest_carts import get_cart as resolve_request_cart
from .guest_accounts import ExistingAccountError, resolve_guest_user


PUBLIC_API_CACHE_SECONDS = getattr(settings, 'PUBLIC_API_CACHE_SECONDS', 60)


def _language_code(request):
    return getattr(request, 'LANGUAGE_CODE', 'en').split('-')[0]


def _cache_get(key):
    if PUBLIC_API_CACHE_SECONDS <= 0:
        return None
    return cache.get(key)


def _cache_set(key, value):
    if PUBLIC_API_CACHE_SECONDS > 0:
        cache.set(key, value, PUBLIC_API_CACHE_SECONDS)


def _bump_product_cache_version(product):
    """Invalidate cached product payloads after a review changes its rating.

    The cache version is derived from the newest Product.updated_at, and writing
    a review does not otherwise touch the product row.
    """
    product.save(update_fields=['updated_at'])


def _product_cache_version():
    """Return a database-backed version shared by every Cloud Run worker."""
    latest_update = Product.objects.aggregate(latest=Max('updated_at'))['latest']
    return latest_update.isoformat() if latest_update else 'empty'


class ExchangeRatesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        force = request.query_params.get('refresh') == '1'
        return Response(get_exchange_rates(force_refresh=force))


# Storefront highlight-chip thresholds. Kept here (not in the React app) so the
# same rule drives the query and the UI copy.
BEST_SELLER_MIN_SALES = 50
# 'Top rated' means real stars now that reviews exist, not wishlist hearts.
TOP_RATED_MIN_STARS = 4

# Sort keys accepted by ?sort=. Every option gets -created_at as a tiebreaker so
# paging stays stable when many rows share a price/sales/likes value.
PRODUCT_SORT_OPTIONS = {
    'newest': ('-created_at',),
    'price-low': ('price', '-created_at'),
    'price-high': ('-price', '-created_at'),
    'sales': ('-sales', '-created_at'),
    'likes': ('-likes', '-created_at'),
    'rating': ('-rating_average', '-review_count', '-created_at'),
}

# Product/Category carry a base field plus per-language variants; the public
# serializer emits whichever matches the request language, so filters have to
# match against all of them to accept whatever string the client saw.
LOCALIZED_SUFFIXES = ('', '_en', '_ja', '_vi')


def _csv_param(params, key):
    """Read a query param that may repeat and/or hold a comma-separated list."""
    values = []
    for raw in params.getlist(key):
        values.extend(part.strip() for part in raw.split(','))
    return [value for value in values if value]


def _decimal_param(params, key):
    raw = (params.get(key) or '').strip()
    if not raw:
        return None
    try:
        return Decimal(raw)
    except (InvalidOperation, ValueError):
        return None


def _localized_q(field, lookup, value):
    """Q matching `value` against `field` and its _en/_ja/_vi variants."""
    query = Q()
    for suffix in LOCALIZED_SUFFIXES:
        query |= Q(**{f'{field}{suffix}__{lookup}': value})
    return query


class ProductPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        Product.objects.filter(status=ProductStatus.PUBLISHED)
        .select_related('category', 'source_info')
        .prefetch_related('gallery')
        # Aggregated here so listing pages don't run a count per product.
        .annotate(
            rating_average=Avg('reviews__rating', filter=Q(reviews__is_published=True)),
            review_count=Count('reviews', filter=Q(reviews__is_published=True)),
        )
        .order_by('-created_at')
    )
    serializer_class = PublicProductSerializer
    pagination_class = ProductPagination

    def _apply_filters(self, queryset, params):
        """Search/filter/sort the catalog in the database.

        These used to run in the browser, which meant every visit to the
        collection page downloaded the entire catalog before showing anything.
        """
        search = (params.get('search') or '').strip()
        if search:
            queryset = queryset.filter(
                _localized_q('name', 'icontains', search)
                | _localized_q('description', 'icontains', search)
                | _localized_q('category__name', 'icontains', search)
                | Q(brand__icontains=search)
            )

        categories = _csv_param(params, 'category')
        if categories:
            queryset = queryset.filter(_localized_q('category__name', 'in', categories))

        brands = _csv_param(params, 'brand')
        if brands:
            queryset = queryset.filter(brand__in=brands)

        price_min = _decimal_param(params, 'price_min')
        if price_min is not None:
            queryset = queryset.filter(price__gte=price_min)

        price_max = _decimal_param(params, 'price_max')
        if price_max is not None:
            queryset = queryset.filter(price__lte=price_max)

        # Highlight chips are OR'd with each other: picking "New" and "Featured"
        # widens the result set rather than requiring both.
        highlights = _csv_param(params, 'filter')
        if highlights:
            highlight_query = Q()
            if 'new' in highlights:
                highlight_query |= Q(is_new=True)
            if 'featured' in highlights:
                highlight_query |= Q(is_featured=True)
            if 'best_sellers' in highlights:
                highlight_query |= Q(sales__gt=BEST_SELLER_MIN_SALES)
            if 'top_rated' in highlights:
                highlight_query |= Q(rating_average__gte=TOP_RATED_MIN_STARS)
            if highlight_query:
                queryset = queryset.filter(highlight_query)

        ordering = PRODUCT_SORT_OPTIONS.get((params.get('sort') or '').strip())
        if ordering:
            queryset = queryset.order_by(*ordering)
        return queryset

    def list(self, request, *args, **kwargs):
        cache_key = (
            f'shop:products:list:{_product_cache_version()}:'
            f'{_language_code(request)}:{request.get_full_path()}'
        )
        payload = _cache_get(cache_key)
        if payload is None:
            queryset = self._apply_filters(self.get_queryset(), request.query_params)
            page = self.paginate_queryset(queryset)
            if page is None:
                payload = self.get_serializer(queryset, many=True).data
            else:
                serializer = self.get_serializer(page, many=True)
                payload = self.get_paginated_response(serializer.data).data
            _cache_set(cache_key, payload)
        return Response(payload)

    def retrieve(self, request, *args, **kwargs):
        cache_key = (
            f'shop:products:detail:{_product_cache_version()}:'
            f'{_language_code(request)}:{kwargs.get("pk", "")}'
        )
        payload = _cache_get(cache_key)
        if payload is None:
            payload = self.get_serializer(self.get_object()).data
            _cache_set(cache_key, payload)
        return Response(payload)

    @action(detail=False, methods=['get'])
    def home(self, request):
        cache_key = (
            f'shop:products:home:{_product_cache_version()}:'
            f'{_language_code(request)}'
        )
        payload = _cache_get(cache_key)
        if payload is None:
            queryset = self.get_queryset()
            candidates = list(queryset[:100])

            new_arrivals = [product for product in candidates if product.is_new][:3]
            new_ids = {product.id for product in new_arrivals}
            new_arrivals.extend(
                product for product in candidates
                if product.id not in new_ids
            )
            new_arrivals = new_arrivals[:3]

            featured = [product for product in candidates if product.is_featured][:4]
            featured_ids = {product.id for product in featured}
            featured.extend(
                product for product in candidates
                if product.id not in featured_ids
            )
            featured = featured[:4]

            payload = {
                'new_arrivals': self.get_serializer(new_arrivals, many=True).data,
                'featured': self.get_serializer(featured, many=True).data,
            }
            _cache_set(cache_key, payload)
        return Response(payload)

    @action(detail=True, methods=['get'])
    def related(self, request, pk=None):
        cache_key = (
            f'shop:products:related:{_product_cache_version()}:'
            f'{_language_code(request)}:{pk}'
        )
        payload = _cache_get(cache_key)
        if payload is None:
            product = self.get_object()
            queryset = self.get_queryset().exclude(pk=product.pk)
            if product.category_id:
                queryset = queryset.annotate(
                    category_priority=Case(
                        When(category_id=product.category_id, then=Value(0)),
                        default=Value(1),
                        output_field=IntegerField(),
                    )
                ).order_by('category_priority', '-created_at')
            else:
                queryset = queryset.order_by('-created_at')
            payload = self.get_serializer(list(queryset[:4]), many=True).data
            _cache_set(cache_key, payload)
        return Response(payload)

    @action(
        detail=True,
        methods=['get', 'post'],
        permission_classes=[AllowAny],
        url_path='reviews',
    )
    def reviews(self, request, pk=None):
        product = self.get_object()

        if request.method == 'GET':
            queryset = (
                ProductReview.objects.filter(product=product, is_published=True)
                .select_related('user')
            )
            page = self.paginate_queryset(queryset)
            serializer = ProductReviewSerializer(
                page if page is not None else queryset,
                many=True,
                context=self.get_serializer_context(),
            )
            if page is not None:
                return self.get_paginated_response(serializer.data)
            return Response(serializer.data)

        if not request.user.is_authenticated:
            return Response(
                {'detail': 'Sign in to review this product.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Only customers who actually received the product may review it.
        delivered_order = (
            Order.objects.filter(
                user=request.user,
                status='delivered',
                items__product=product,
            )
            .order_by('-created_at')
            .first()
        )
        if delivered_order is None:
            return Response(
                {
                    'detail': 'Only customers with a delivered order for this '
                              'product can review it.',
                    'code': 'purchase_required',
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ProductReviewWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Re-submitting replaces the existing review rather than erroring on the
        # one-review-per-product constraint.
        review, _created = ProductReview.objects.update_or_create(
            product=product,
            user=request.user,
            defaults={
                **serializer.validated_data,
                'order': delivered_order,
                'is_verified_purchase': True,
            },
        )
        _bump_product_cache_version(product)
        return Response(
            ProductReviewSerializer(
                review, context=self.get_serializer_context()
            ).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=['get'],
        permission_classes=[IsAuthenticated],
        url_path='review-eligibility',
    )
    def review_eligibility(self, request, pk=None):
        """Tell the storefront whether to offer the review form, and prefill it."""
        product = self.get_object()
        has_delivered_order = Order.objects.filter(
            user=request.user, status='delivered', items__product=product
        ).exists()
        existing = ProductReview.objects.filter(
            product=product, user=request.user
        ).first()
        return Response({
            'can_review': has_delivered_order,
            'existing_review': (
                ProductReviewSerializer(
                    existing, context=self.get_serializer_context()
                ).data
                if existing else None
            ),
        })

    @action(detail=False, methods=['get'])
    def facets(self, request):
        """Filter options for the collection page.

        The storefront used to derive the brand list by scanning every product
        it had downloaded. Now that listing is paginated, the options have to
        come from the whole catalog rather than the current page.
        """
        cache_key = f'shop:products:facets:{_product_cache_version()}'
        payload = _cache_get(cache_key)
        if payload is None:
            published = Product.objects.filter(status=ProductStatus.PUBLISHED)
            brands = sorted(
                {
                    brand.strip()
                    for brand in published.values_list('brand', flat=True)
                    if brand and brand.strip()
                }
            )
            bounds = published.aggregate(min_price=Min('price'), max_price=Max('price'))
            payload = {
                'brands': brands,
                'price_min': str(bounds['min_price']) if bounds['min_price'] is not None else None,
                'price_max': str(bounds['max_price']) if bounds['max_price'] is not None else None,
            }
            _cache_set(cache_key, payload)
        return Response(payload)

    @action(detail=False, methods=['get'])
    def likes_counts(self, request):
        products = Product.objects.filter(status=ProductStatus.PUBLISHED).values('id', 'likes')
        return Response(list(products))

class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """The customer's own notification feed."""

    permission_classes = [IsAuthenticated]
    serializer_class = CustomerNotificationSerializer
    pagination_class = ProductPagination

    def get_queryset(self):
        return CustomerNotification.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        return Response({
            'unread': self.get_queryset().filter(is_read=False).count(),
        })

    @action(detail=True, methods=['post'], url_path='read')
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=['is_read'])
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=['post'], url_path='read-all')
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({'updated': updated})


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    def list(self, request, *args, **kwargs):
        cache_key = f'shop:categories:{_language_code(request)}'
        payload = _cache_get(cache_key)
        if payload is None:
            payload = self.get_serializer(self.get_queryset(), many=True).data
            _cache_set(cache_key, payload)
        return Response(payload)

class OrderHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = OrderSerializer

    def list(self, request, *args, **kwargs):
        expire_pending_payments()
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        return (
            Order.objects.filter(user=self.request.user)
            .select_related('payment')
            .prefetch_related('items__product__category', 'items__product__source_info')
            .order_by('-created_at')
        )

    @action(detail=True, methods=['get'], url_path='invoice')
    def download_invoice(self, request, pk=None):
        """Download PDF invoice for this order."""
        order = self.get_object()
        pdf_buffer = generate_invoice_pdf(order, request)
        filename = generate_invoice_filename(order)
        response = FileResponse(
            pdf_buffer,
            content_type='application/pdf',
            as_attachment=True,
            filename=filename,
        )
        return response

class CartViewSet(viewsets.ViewSet):
    # Guests can fill a cart before deciding whether to create an account;
    # their cart is keyed on the session and merged in when they sign in.
    permission_classes = [AllowAny]

    def _get_cart(self, request):
        return resolve_request_cart(request, create=True)

    @action(detail=False, methods=['get'])
    def get_cart(self, request):
        cart = self._get_cart(request)
        serializer = CartSerializer(cart)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def add_item(self, request):
        cart = self._get_cart(request)
        product_id = request.data.get('product_id')
        try:
            quantity = int(request.data.get('quantity', 1))
        except (TypeError, ValueError):
            return Response(
                {"error": "Quantity must be a positive integer", "cart_error_code": "invalid_quantity"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not product_id:
            return Response({"error": "product_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        if quantity <= 0:
            return Response(
                {"error": "Quantity must be a positive integer", "cart_error_code": "invalid_quantity"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            product = Product.objects.get(pk=product_id, status=ProductStatus.PUBLISHED)
        except Product.DoesNotExist:
            return Response({"error": "Product not found"}, status=status.HTTP_404_NOT_FOUND)

        cart_item = CartItem.objects.filter(cart=cart, product=product).first()
        requested_quantity = quantity + (cart_item.quantity if cart_item else 0)
        if requested_quantity > product.stock:
            return Response(
                {
                    "error": f"Insufficient stock for {product.name}. Available: {product.stock}",
                    "cart_error_code": "insufficient_stock",
                    "product_name": product.name,
                    "available_stock": product.stock,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if cart_item:
            cart_item.quantity = requested_quantity
            cart_item.price = product.price
            cart_item.save(update_fields=['quantity', 'price'])
        else:
            CartItem.objects.create(
                cart=cart,
                product=product,
                quantity=quantity,
                price=product.price,
            )

        serializer = CartSerializer(cart)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def update_item(self, request):
        cart = self._get_cart(request)
        product_id = request.data.get('product_id')
        try:
            quantity = int(request.data.get('quantity', 1))
        except (TypeError, ValueError):
            return Response(
                {"error": "Quantity must be zero or a positive integer", "cart_error_code": "invalid_quantity"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not product_id:
            return Response({"error": "product_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            cart_item = CartItem.objects.get(cart=cart, product_id=product_id)
            if quantity <= 0:
                cart_item.delete()
            elif quantity > cart_item.product.stock:
                return Response(
                    {
                        "error": f"Insufficient stock for {cart_item.product.name}. Available: {cart_item.product.stock}",
                        "cart_error_code": "insufficient_stock",
                        "product_name": cart_item.product.name,
                        "available_stock": cart_item.product.stock,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            else:
                cart_item.quantity = quantity
                cart_item.price = cart_item.product.price
                cart_item.save(update_fields=['quantity', 'price'])
        except CartItem.DoesNotExist:
            return Response({"error": "Item not in cart"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = CartSerializer(cart)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def remove_item(self, request):
        cart = self._get_cart(request)
        product_id = request.data.get('product_id')

        if not product_id:
            return Response({"error": "product_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            cart_item = CartItem.objects.get(cart=cart, product_id=product_id)
            cart_item.delete()
        except CartItem.DoesNotExist:
            pass

        serializer = CartSerializer(cart)
        return Response(serializer.data)

class CheckoutViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]

    def _get_cart(self, request):
        return resolve_request_cart(request)

    @action(detail=False, methods=['post'])
    def process_checkout(self, request):
        cart = self._get_cart(request)
        if not cart or not cart.items.exists():
            return Response(
                {"error": "Cart is empty", "checkout_error_code": "empty_cart"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        payment_method = normalize_payment_method(request.data.get('payment_method'))
        email = request.data.get('email')
        first_name = request.data.get('first_name')
        last_name = request.data.get('last_name')
        phone = request.data.get('phone')
        address = request.data.get('address')
        coupon_code = normalize_coupon_code(request.data.get('coupon_code'))
        affiliate_code = normalize_affiliate_code(request.data.get('affiliate_code'))

        # Fallback to user data if authenticated
        if user.is_authenticated:
            email = email or user.email
            first_name = first_name or user.first_name
            last_name = last_name or user.last_name
            
            try:
                profile = user.profile
                phone = phone or profile.phone
                address = address or profile.address
            except UserProfile.DoesNotExist:
                profile = UserProfile.objects.create(user=user)
                phone = phone or ""
                address = address or ""

        if not email:
            return Response(
                {"error": "Email is required", "checkout_error_code": "email_required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_guest_checkout = not user.is_authenticated
        if is_guest_checkout:
            try:
                user = resolve_guest_user(email, first_name or '', last_name or '')
            except ExistingAccountError:
                # Attaching to a registered account would drop a stranger's
                # order into that person's history, so ask them to sign in.
                return Response(
                    {
                        "error": "An account already exists for this email. "
                                 "Please sign in to complete your order.",
                        "checkout_error_code": "account_exists",
                    },
                    status=status.HTTP_409_CONFLICT,
                )

        if payment_method not in PaymentMethodConfig.Code.values:
            return Response(
                {
                    "error": "Invalid payment method",
                    "payment_error_code": "invalid_payment_method",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            method_config = enabled_payment_method(payment_method, for_update=True)
            if not method_config:
                return Response(
                    {
                        "error": "This payment method is currently unavailable",
                        "payment_error_code": "payment_method_unavailable",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                # Re-read under lock by primary key: a guest cart has no user
                # yet, so it cannot be matched on the user column.
                cart = Cart.objects.select_for_update().get(pk=cart.pk)
            except Cart.DoesNotExist:
                return Response(
                    {"error": "Cart is empty", "checkout_error_code": "empty_cart"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            cart_items = list(
                CartItem.objects.select_for_update()
                .filter(cart=cart)
                .order_by('id')
            )
            if not cart_items:
                return Response(
                    {"error": "Cart is empty", "checkout_error_code": "empty_cart"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            product_ids = [item.product_id for item in cart_items if item.product_id]
            products = {
                product.pk: product
                for product in Product.objects.select_for_update().filter(pk__in=product_ids)
            }
            if len(products) != len(set(product_ids)):
                return Response(
                    {
                        "error": "A product in your cart is no longer available",
                        "checkout_error_code": "product_unavailable",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Always calculate prices from the current product records. Cart prices are
            # only display snapshots and must never be trusted for payment totals.
            subtotal_amount = sum(
                (products[item.product_id].price * item.quantity for item in cart_items),
                0,
            )
            for item in cart_items:
                item.product = products[item.product_id]
            shipping_amount = calculate_shipping_amount(cart_items)

            coupon = None
            discount_amount = 0
            if coupon_code:
                try:
                    coupon = (
                        Coupon.objects.select_for_update()
                        .select_related('affiliate', 'affiliate__user')
                        .get(code=coupon_code)
                    )
                except Coupon.DoesNotExist:
                    return Response(
                        {"error": "Coupon is invalid", "coupon_error_code": "invalid"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                try:
                    discount_amount = validate_coupon(coupon, user, subtotal_amount)
                except CouponValidationError as exc:
                    return Response(
                        {"error": "Coupon cannot be applied", "coupon_error_code": exc.code},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # Validate stock after all totals and coupon conditions are known.
            for item in cart_items:
                if item.product.status != ProductStatus.PUBLISHED:
                    return Response({
                        "error": f"Product {item.product.name} is not available for checkout",
                        "checkout_error_code": "product_unavailable",
                        "product_name": item.product.name,
                    }, status=status.HTTP_400_BAD_REQUEST)
                if item.product.stock < item.quantity:
                    return Response({
                        "error": f"Insufficient stock for {item.product.name}. Available: {item.product.stock}",
                        "checkout_error_code": "insufficient_stock",
                        "product_name": item.product.name,
                        "available_stock": item.product.stock,
                    }, status=status.HTTP_400_BAD_REQUEST)

            # Update profile only after the complete order has passed validation.
            if first_name:
                user.first_name = first_name
            if last_name:
                user.last_name = last_name
            if email:
                user.email = email
            user.save()

            profile, _ = UserProfile.objects.get_or_create(user=user)
            if phone:
                profile.phone = phone
            if address:
                profile.address = address
            profile.save()

            affiliate = None
            affiliate_source = ''
            if coupon and coupon.affiliate_id:
                coupon_affiliate = coupon.affiliate
                if (
                    coupon_affiliate.status == AffiliateProfile.Status.ACTIVE
                    and coupon_affiliate.user_id != user.id
                ):
                    affiliate = coupon_affiliate
                    affiliate_source = 'coupon'
            elif affiliate_code:
                affiliate = resolve_active_affiliate(
                    affiliate_code, customer=user, for_update=True
                )
                if affiliate:
                    affiliate_source = 'link'

            total_amount = subtotal_amount + shipping_amount - discount_amount
            order = Order.objects.create(
                user=user,
                subtotal_amount=subtotal_amount,
                shipping_amount=shipping_amount,
                discount_amount=discount_amount,
                total_amount=total_amount,
                coupon=coupon,
                coupon_code=coupon.code if coupon else '',
                affiliate=affiliate,
                affiliate_code=affiliate.code if affiliate else '',
                affiliate_attribution_source=affiliate_source,
                affiliate_commission_rate=(
                    affiliate.commission_rate if affiliate else 0
                ),
                payment_method=payment_method,
                status=(
                    'processing'
                    if payment_method == PaymentMethodConfig.Code.COD
                    else 'pending'
                ),
            )

            payment = create_payment_transaction(order, method_config)

            for item in cart_items:
                OrderItem.objects.create(
                    order=order,
                    product=item.product,
                    product_name=item.product.name,
                    quantity=item.quantity,
                    price=item.product.price,
                    unit_cost_vnd=item.product.cost_price_vnd,
                )
                
                # Update Inventory
                product = item.product
                product.stock -= item.quantity
                product.sales += item.quantity
                product.save()

            if coupon:
                CouponRedemption.objects.create(
                    coupon=coupon,
                    user=user,
                    order=order,
                    discount_amount=discount_amount,
                )
                coupon.used_count += 1
                coupon.save(update_fields=['used_count', 'updated_at'])

            if affiliate:
                create_order_commission(order, affiliate)

            cart.delete()

        response_data = {
            "message": "Order placed successfully",
            "order": OrderSerializer(order, context={'request': request}).data,
            # Lets the confirmation screen invite guests to set a password and
            # keep their order history.
            "guest_checkout": is_guest_checkout,
        }
        payment_data = PaymentTransactionPublicSerializer(
            payment, context={'request': request}
        ).data
        response_data['payment'] = payment_data

        # Send Email
        invoice_content = (
            f"Order {order.order_code}\n"
            f"Subtotal: {order.subtotal_amount}\n"
            f"Shipping: {order.shipping_amount}\n"
        )
        if order.coupon_code:
            invoice_content += f"Coupon: {order.coupon_code}\nDiscount: -{order.discount_amount}\n"
        invoice_content += f"Total: {order.total_amount}\nPayment Method: {order.payment_method}\n"
        for item in order.items.all():
            invoice_content += f"- Product: {item.product_name}, Qty: {item.quantity}, Price: {item.price}\n"

        try:
            send_mail(
                'Your Invoice',
                invoice_content,
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=True,
            )
        except Exception as e:
            print(f"Failed to send email: {e}")

        if payment_method == PaymentMethodConfig.Code.BANK_TRANSFER:
            response_data['bank_details'] = {
                **(payment_data.get('bank_details') or {}),
                'qr_code_url': payment_data.get('qr_code_url'),
                'amount': payment_data.get('settlement_amount'),
                'currency': payment_data.get('settlement_currency'),
                'reference': payment.reference,
                'expires_at': payment_data.get('expires_at'),
            }

        from admin_api.chat_proxy import notify_order_placed
        if payment_method == PaymentMethodConfig.Code.COD:
            notify_order_placed(order.id, order.total_amount)

        return Response(response_data)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        user = request.user
        # Update user fields
        for attr in ['first_name', 'last_name', 'email']:
            if attr in request.data:
                setattr(user, attr, request.data[attr])
        user.save()
        
        # Validate profile fields instead of assigning raw request values.
        profile, created = UserProfile.objects.get_or_create(user=user)
        profile_serializer = UserProfileSerializer(
            profile,
            data=request.data,
            partial=True,
        )
        profile_serializer.is_valid(raise_exception=True)
        profile_serializer.save()
        
        return Response(UserSerializer(user).data)

class FavoriteViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        favorites = (
            Favorite.objects.filter(
                user=request.user,
                product__status=ProductStatus.PUBLISHED,
            )
            .select_related('product__category', 'product__source_info')
            .prefetch_related('product__gallery')
            .order_by('-created_at')
        )
        serializer = FavoriteSerializer(favorites, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def add(self, request):
        product_id = request.data.get('product_id')
        if not product_id:
            return Response({"error": "product_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            product = Product.objects.get(id=product_id, status=ProductStatus.PUBLISHED)
        except Product.DoesNotExist:
            return Response({"error": "Product not found"}, status=status.HTTP_404_NOT_FOUND)

        favorite, created = Favorite.objects.get_or_create(user=request.user, product=product)
        if created:
            product.likes += 1
            product.save()
            
        serializer = FavoriteSerializer(favorite, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def remove(self, request):
        product_id = request.data.get('product_id')
        if not product_id:
            return Response({"error": "product_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({"error": "Product not found"}, status=status.HTTP_404_NOT_FOUND)

        deleted, _ = Favorite.objects.filter(user=request.user, product=product).delete()
        if deleted:
            if product.likes > 0:
                product.likes -= 1
                product.save()
            return Response({"message": "Removed from favorites"}, status=status.HTTP_200_OK)
        return Response({"error": "Favorite not found"}, status=status.HTTP_404_NOT_FOUND)


PUBLIC_CONTENT_SETTING_KEYS = frozenset({
    'home_hero_title',
    'home_hero_subtitle',
    'home_hero_cta',
    'login_hero_text',
})


PUBLIC_SETTING_KEYS = frozenset({
    'login_background_image',
    'home_hero_image',
    *PUBLIC_CONTENT_SETTING_KEYS,
    *(f'{key}_{language}' for key in PUBLIC_CONTENT_SETTING_KEYS for language in ('en', 'ja', 'vi')),
})


PUBLIC_MEDIA_PREFIXES = ('system_images/', 'products/')


class PublicMediaView(APIView):
    """Serve uploaded media via API (correct Content-Type + CORS for cross-origin <img>)."""
    permission_classes = [AllowAny]

    def get(self, request, path):
        safe = path.replace('\\', '/').lstrip('/')
        if not safe or '..' in safe.split('/'):
            raise Http404
        if not any(safe.startswith(prefix) for prefix in PUBLIC_MEDIA_PREFIXES):
            raise Http404

        try:
            if not default_storage.exists(safe):
                raise Http404
            media = default_storage.open(safe, 'rb')
        except Http404:
            raise
        except (FileNotFoundError, OSError, ValueError):
            raise Http404 from None

        content_type, _ = mimetypes.guess_type(safe)
        response = FileResponse(media, content_type=content_type or 'application/octet-stream')
        response['Cross-Origin-Resource-Policy'] = 'cross-origin'
        response['Cache-Control'] = 'public, max-age=86400'
        return response


class PublicSettingsView(APIView):
    """Read-only access to public site settings (no auth required)."""
    permission_classes = [AllowAny]

    def get(self, request):
        from admin_api.models import Setting

        key = request.query_params.get('key')
        cache_key = f'shop:public-settings:{key or "all"}'
        payload = _cache_get(cache_key)
        if payload is not None:
            return Response(payload)

        qs = Setting.objects.filter(key__in=PUBLIC_SETTING_KEYS)
        if key:
            if key not in PUBLIC_SETTING_KEYS:
                return Response([])
            qs = qs.filter(key=key)

        payload = [{'key': s.key, 'value': s.value} for s in qs]
        _cache_set(cache_key, payload)
        return Response(payload)
