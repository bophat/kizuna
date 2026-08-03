from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Cart,
    CartItem,
    Category,
    ContactInfo,
    ContactMessage,
    Favorite,
    Order,
    OrderItem,
    Product,
    ProductImage,
    StorePage,
    UserProfile,
)
from .image_urls import resolve_image_url, resolve_product_image_url


SUPPORTED_CONTENT_LANGUAGES = frozenset({'en', 'ja', 'vi'})


def request_language(context):
    request = context.get('request')
    language = getattr(request, 'LANGUAGE_CODE', 'en') if request else 'en'
    language = language.split('-')[0]
    return language if language in SUPPORTED_CONTENT_LANGUAGES else 'en'


def localized_value(instance, field_name, context):
    language = request_language(context)
    translated = getattr(instance, f'{field_name}_{language}', '')
    return translated.strip() if isinstance(translated, str) and translated.strip() else getattr(instance, field_name)

class CategorySerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug']

    def get_name(self, obj):
        return localized_value(obj, 'name', self.context)


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['id', 'image', 'is_primary']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['image'] = resolve_image_url(instance.image, self.context.get('request'))
        return ret


class PublicProductSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()
    gallery = ProductImageSerializer(many=True, read_only=True)
    class Meta:
        model = Product
        fields = [
            'id', 'name', 'price', 'currency', 'category',
            'brand', 'location', 'description', 'image', 'gallery',
            'is_limited', 'is_new', 'is_featured', 'is_cheap',
            'likes', 'sales', 'stock', 'weight'
        ]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['image'] = resolve_product_image_url(
            instance,
            self.context.get('request'),
        )
        return ret

    def get_name(self, obj):
        return localized_value(obj, 'name', self.context)

    def get_description(self, obj):
        return localized_value(obj, 'description', self.context)

    def get_category(self, obj):
        if not obj.category:
            return None
        return localized_value(obj.category, 'name', self.context)

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['phone', 'address', 'points']

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'profile', 'date_joined', 'is_staff', 'is_superuser', 'avatar_url']

    def get_avatar_url(self, obj):
        if hasattr(obj, 'profile') and obj.profile.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile.avatar.url)
            return obj.profile.avatar.url
        return None

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
    product_name = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ['id', 'product_id', 'product_name', 'quantity', 'price', 'image']

    def get_image(self, obj):
        if not obj.product:
            return None
        return resolve_product_image_url(obj.product, self.context.get('request'))

    def get_product_name(self, obj):
        if obj.product:
            return localized_value(obj.product, 'name', self.context)
        return obj.product_name

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


class StorePagePublicSerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    content = serializers.SerializerMethodField()

    class Meta:
        model = StorePage
        fields = ['slug', 'title', 'content', 'content_type', 'updated_at']

    def get_title(self, obj):
        return localized_value(obj, 'title', self.context)

    def get_content(self, obj):
        return localized_value(obj, 'content', self.context)


class ContactInfoPublicSerializer(serializers.ModelSerializer):
    address = serializers.SerializerMethodField()
    working_hours = serializers.SerializerMethodField()

    class Meta:
        model = ContactInfo
        fields = [
            'phone', 'email', 'address', 'working_hours',
            'facebook_url', 'zalo_url', 'instagram_url', 'tiktok_url',
            'updated_at',
        ]

    def get_address(self, obj):
        return localized_value(obj, 'address', self.context)

    def get_working_hours(self, obj):
        return localized_value(obj, 'working_hours', self.context)


class ContactMessageSubmitSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ['name', 'email', 'message']

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Name is required.')
        return value

    def validate_message(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Message is required.')
        if len(value) > 5000:
            raise serializers.ValidationError('Message must not exceed 5000 characters.')
        return value
