from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Cart, CartItem, Order, OrderItem, UserProfile, Product, Category, Favorite, ProductImage

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug']


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['id', 'image', 'is_primary']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if instance.image:
            if instance.image.name.startswith('http'):
                ret['image'] = instance.image.name
            else:
                request = self.context.get('request')
                if request:
                    ret['image'] = request.build_absolute_uri(instance.image.url)
                else:
                    ret['image'] = instance.image.url
        else:
            ret['image'] = None
        return ret


class PublicProductSerializer(serializers.ModelSerializer):
    category = serializers.ReadOnlyField(source='category.name')
    gallery = ProductImageSerializer(many=True, read_only=True)
    class Meta:
        model = Product
        fields = [
            'id', 'name', 'price', 'currency', 'category',
            'brand', 'location', 'description', 'image', 'gallery',
            'is_limited', 'is_new', 'is_featured', 'is_cheap',
            'likes', 'sales', 'stock'
        ]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if instance.image:
            if instance.image.name.startswith('http'):
                ret['image'] = instance.image.name
            else:
                request = self.context.get('request')
                if request:
                    ret['image'] = request.build_absolute_uri(instance.image.url)
                else:
                    ret['image'] = instance.image.url
        else:
            ret['image'] = None
        return ret

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['phone', 'address', 'points']

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'profile']

class CartItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = CartItem
        fields = ['id', 'product_id', 'quantity', 'price']

class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Cart
        fields = ['id', 'items', 'total_amount', 'created_at', 'updated_at']

class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(read_only=True)
    image = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ['id', 'product_id', 'product_name', 'quantity', 'price', 'image']

    def get_image(self, obj):
        if obj.product and obj.product.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.product.image.url)
            return obj.product.image.url
        return None

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = ['id', 'status', 'payment_method', 'total_amount', 'items', 'created_at', 'updated_at']

class FavoriteSerializer(serializers.ModelSerializer):
    product = PublicProductSerializer(read_only=True)

    class Meta:
        model = Favorite
        fields = ['id', 'product', 'created_at']
