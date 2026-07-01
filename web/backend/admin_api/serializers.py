from rest_framework import serializers
from shop.models import Product, Order, OrderItem, Category, UserProfile, ProductImage
from django.contrib.auth.models import User
from .models import Setting, PendingReply, TrendingProductLead
from .secrets import (
    expose_setting_for_api,
    is_secret_setting_key,
    prepare_setting_for_storage,
)

class UserSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(source='profile.phone', required=False, allow_null=True, allow_blank=True)
    address = serializers.CharField(source='profile.address', required=False, allow_null=True, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_superuser', 'password', 'phone', 'address', 'date_joined']

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        profile_data = validated_data.pop('profile', {})

        user = User.objects.create(**validated_data)
        if password:
            user.set_password(password)
            user.save()

        # Create user profile
        if profile_data:
            UserProfile.objects.create(user=user, **profile_data)

        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        profile_data = validated_data.pop('profile', {})

        # Update user fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()

        # Update or create profile
        if profile_data:
            profile, created = UserProfile.objects.get_or_create(user=instance)
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()

        return instance

class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(source='products.count', read_only=True)
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'product_count']

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    class Meta:
        model = Product
        fields = [
            'id', 'name', 'price', 'currency', 'category', 'category_name',
            'brand', 'location', 'description', 'image',
            'is_limited', 'is_new', 'is_featured', 'is_cheap',
            'likes', 'sales', 'stock', 'weight', 'created_at', 'updated_at'
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

class OrderItemSerializer(serializers.ModelSerializer):
    product_details = ProductSerializer(source='product', read_only=True)
    
    class Meta:
        model = OrderItem
        fields = ['id', 'order', 'product', 'product_name', 'quantity', 'price', 'product_details']
        read_only_fields = ['id', 'product_details']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    user_details = UserSerializer(source='user', read_only=True)
    payment_receipt = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = '__all__'

    def get_payment_receipt(self, obj):
        if obj.payment_receipt:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.payment_receipt.url)
            return obj.payment_receipt.url
        return None

class SettingSerializer(serializers.ModelSerializer):
    is_secret = serializers.SerializerMethodField()

    class Meta:
        model = Setting
        fields = ['id', 'key', 'value', 'description', 'is_secret', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_secret']

    def get_is_secret(self, obj) -> bool:
        return is_secret_setting_key(obj.key)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if is_secret_setting_key(instance.key):
            ret['value'] = expose_setting_for_api(instance.key, instance.value)
        return ret

    def validate(self, attrs):
        key = attrs.get('key') or getattr(self.instance, 'key', None)
        value = attrs.get('value')
        if key and value is not None and is_secret_setting_key(key):
            existing = ''
            if self.instance is not None:
                existing = self.instance.value
            attrs['value'] = prepare_setting_for_storage(key, value, existing)
        return attrs

class ProductImageSerializer(serializers.ModelSerializer):
    product = serializers.PrimaryKeyRelatedField(queryset=ProductImage._meta.get_field('product').related_model.objects.all())

    class Meta:
        model = ProductImage
        fields = ['id', 'product', 'image', 'is_primary', 'display_order', 'created_at']
        read_only_fields = ['id', 'created_at']

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


class PendingReplySerializer(serializers.ModelSerializer):
    class Meta:
        model = PendingReply
        fields = [
            'id', 'channel', 'customer_id', 'customer_name', 'incoming_message',
            'draft_reply', 'status', 'is_greeting', 'metadata',
            'created_at', 'reviewed_at', 'sent_at',
        ]
        read_only_fields = ['id', 'created_at', 'reviewed_at', 'sent_at', 'status']


class TrendingProductLeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrendingProductLead
        fields = [
            'id', 'query', 'product_name', 'platform', 'source_url',
            'price_info', 'status', 'raw_data', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']
