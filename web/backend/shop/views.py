from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.mail import send_mail
from django.db import transaction
from .models import Cart, CartItem, Order, OrderItem, UserProfile, Product, Category, Favorite
from .serializers import CartSerializer, OrderSerializer, UserSerializer, PublicProductSerializer, CategorySerializer, FavoriteSerializer

class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Product.objects.all().order_by('-created_at')
    serializer_class = PublicProductSerializer

    @action(detail=False, methods=['get'])
    def likes_counts(self, request):
        products = Product.objects.all().values('id', 'likes')
        return Response(list(products))

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

class OrderHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).order_by('-created_at')

class CartViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _get_cart(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        return cart

    @action(detail=False, methods=['get'])
    def get_cart(self, request):
        cart = self._get_cart(request)
        serializer = CartSerializer(cart)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def add_item(self, request):
        cart = self._get_cart(request)
        product_id = request.data.get('product_id')
        quantity = int(request.data.get('quantity', 1))
        price = request.data.get('price')

        if not product_id or not price:
            return Response({"error": "product_id and price are required"}, status=status.HTTP_400_BAD_REQUEST)

        cart_item, created = CartItem.objects.get_or_create(
            cart=cart,
            product_id=product_id,
            defaults={'price': price}
        )

        if not created:
            cart_item.quantity += quantity
            cart_item.save()

        serializer = CartSerializer(cart)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def update_item(self, request):
        cart = self._get_cart(request)
        product_id = request.data.get('product_id')
        quantity = int(request.data.get('quantity', 1))

        if not product_id:
            return Response({"error": "product_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            cart_item = CartItem.objects.get(cart=cart, product_id=product_id)
            if quantity <= 0:
                cart_item.delete()
            else:
                cart_item.quantity = quantity
                cart_item.save()
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
    permission_classes = [IsAuthenticated]

    def _get_cart(self, request):
        return Cart.objects.filter(user=request.user).first()

    @action(detail=False, methods=['post'])
    def process_checkout(self, request):
        cart = self._get_cart(request)
        if not cart or not cart.items.exists():
            return Response({"error": "Cart is empty"}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        payment_method = request.data.get('payment_method')
        email = request.data.get('email')
        first_name = request.data.get('first_name')
        last_name = request.data.get('last_name')
        phone = request.data.get('phone')
        address = request.data.get('address')

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
            return Response({"error": "Email is required"}, status=status.HTTP_400_BAD_REQUEST)

        if payment_method not in ['cash', 'bank_transfer']:
            return Response({"error": "Invalid payment method. Use 'cash' or 'bank_transfer'"}, status=status.HTTP_400_BAD_REQUEST)

        # Map frontend payment method to model choices
        db_payment_method = 'transfer' if payment_method == 'bank_transfer' else 'cash'

        with transaction.atomic():
            # Update user profile info with what was provided in checkout
            if user.is_authenticated:
                if first_name: user.first_name = first_name
                if last_name: user.last_name = last_name
                if email: user.email = email
                user.save()

                profile, _ = UserProfile.objects.get_or_create(user=user)
                if phone: profile.phone = phone
                if address: profile.address = address
                profile.save()

            # 1. Validate Stock first
            for item in cart.items.all():
                if item.product.stock < item.quantity:
                    return Response({
                        "error": f"Insufficient stock for {item.product.name}. Available: {item.product.stock}"
                    }, status=status.HTTP_400_BAD_REQUEST)

            # 2. Create Order
            order = Order.objects.create(
                user=user if user.is_authenticated else None,
                total_amount=cart.total_amount,
                payment_method=db_payment_method,
                status='pending'
            )

            # 3. Create OrderItems and Update Stock/Sales
            for item in cart.items.all():
                OrderItem.objects.create(
                    order=order,
                    product=item.product,
                    product_name=item.product.name,
                    quantity=item.quantity,
                    price=item.price
                )
                
                # Update Inventory
                product = item.product
                product.stock -= item.quantity
                product.sales += item.quantity
                product.save()

            # 4. Clear Cart
            cart.delete()

        response_data = {
            "message": "Order placed successfully",
            "order": OrderSerializer(order).data,
        }

        # Send Email
        invoice_content = f"Order #{order.id}\nTotal: {order.total_amount}\nPayment Method: {order.payment_method}\n"
        for item in order.items.all():
            invoice_content += f"- Product: {item.product_name}, Qty: {item.quantity}, Price: {item.price}\n"

        try:
            send_mail(
                'Your Invoice',
                invoice_content,
                'from@example.com',
                [email],
                fail_silently=True,
            )
        except Exception as e:
            print(f"Failed to send email: {e}")

        if payment_method == 'bank_transfer':
            response_data['bank_details'] = {
                "bank_name": "Vietcombank",
                "account_number": "0123456789",
                "account_name": "NGUYEN VAN A",
                "qr_code_url": f"https://img.vietqr.io/image/vcb-0123456789-compact.png?amount={order.total_amount}&addInfo=ORDER{order.id}"
            }

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
        
        # Update profile fields
        profile, created = UserProfile.objects.get_or_create(user=user)
        for attr in ['phone', 'address']:
            if attr in request.data:
                setattr(profile, attr, request.data[attr])
        profile.save()
        
        return Response(UserSerializer(user).data)

class FavoriteViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        favorites = Favorite.objects.filter(user=request.user).order_by('-created_at')
        serializer = FavoriteSerializer(favorites, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def add(self, request):
        product_id = request.data.get('product_id')
        if not product_id:
            return Response({"error": "product_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            product = Product.objects.get(id=product_id)
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
