from rest_framework import serializers
from shop.models import (
    Category,
    ContactInfo,
    ContactMessage,
    Coupon,
    Order,
    OrderItem,
    Product,
    ProductImage,
    StorePage,
    UserProfile,
)
from shop.content_sanitizer import sanitize_store_page_html
from django.contrib.auth.models import User
from .models import Setting, PendingReply, TrendingProductLead
from .secrets import (
    expose_setting_for_api,
    is_secret_setting_key,
    prepare_setting_for_storage,
)
from shop.image_urls import resolve_image_url, resolve_product_image_url

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
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'name_en', 'name_ja', 'name_vi', 'slug', 'product_count']

    def get_product_count(self, obj):
        annotated_count = getattr(obj, 'product_count', None)
        return annotated_count if annotated_count is not None else obj.products.count()


class CouponSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Coupon
        fields = [
            'id', 'code', 'description', 'discount_type', 'discount_value',
            'minimum_order_amount', 'maximum_discount_amount', 'usage_limit',
            'per_user_limit', 'used_count', 'starts_at', 'expires_at',
            'is_active', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'used_count', 'created_by_name', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return ''
        return obj.created_by.get_full_name().strip() or obj.created_by.username

    def validate_code(self, value):
        code = value.strip().upper()
        queryset = Coupon.objects.filter(code__iexact=code)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('A coupon with this code already exists.')
        return code

    def validate(self, attrs):
        discount_type = attrs.get(
            'discount_type', getattr(self.instance, 'discount_type', None)
        )
        discount_value = attrs.get(
            'discount_value', getattr(self.instance, 'discount_value', None)
        )
        starts_at = attrs.get('starts_at', getattr(self.instance, 'starts_at', None))
        expires_at = attrs.get('expires_at', getattr(self.instance, 'expires_at', None))
        maximum = attrs.get(
            'maximum_discount_amount',
            getattr(self.instance, 'maximum_discount_amount', None),
        )

        errors = {}
        if discount_value is not None and discount_value <= 0:
            errors['discount_value'] = 'Discount value must be greater than zero.'
        elif (
            discount_type == Coupon.DiscountType.PERCENTAGE
            and discount_value is not None
            and discount_value > 100
        ):
            errors['discount_value'] = 'Percentage discount cannot exceed 100.'
        if attrs.get('minimum_order_amount', 0) is not None and attrs.get(
            'minimum_order_amount', getattr(self.instance, 'minimum_order_amount', 0)
        ) < 0:
            errors['minimum_order_amount'] = 'Minimum order amount cannot be negative.'
        if maximum is not None and maximum <= 0:
            errors['maximum_discount_amount'] = 'Maximum discount must be greater than zero.'
        usage_limit = attrs.get('usage_limit', getattr(self.instance, 'usage_limit', None))
        per_user_limit = attrs.get(
            'per_user_limit', getattr(self.instance, 'per_user_limit', 1)
        )
        if usage_limit is not None and usage_limit < 1:
            errors['usage_limit'] = 'Usage limit must be at least one.'
        if per_user_limit is not None and per_user_limit < 1:
            errors['per_user_limit'] = 'Per-user limit must be at least one.'
        if starts_at and expires_at and starts_at >= expires_at:
            errors['expires_at'] = 'Expiry time must be after the start time.'
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    class Meta:
        model = Product
        fields = [
            'id', 'name', 'name_en', 'name_ja', 'name_vi',
            'price', 'currency', 'category', 'category_name',
            'brand', 'location', 'description', 'description_en',
            'description_ja', 'description_vi', 'image', 'status',
            'is_limited', 'is_new', 'is_featured', 'is_cheap',
            'likes', 'sales', 'stock', 'weight', 'created_at', 'updated_at'
        ]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['image'] = resolve_product_image_url(
            instance,
            self.context.get('request'),
        )
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
        ret['image'] = resolve_image_url(instance.image, self.context.get('request'))
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


class AdminStorePageSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StorePage
        fields = [
            'id', 'slug', 'title', 'title_en', 'title_ja', 'title_vi',
            'content', 'content_en', 'content_ja', 'content_vi',
            'content_type', 'is_published',
            'updated_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'slug', 'updated_by_name', 'created_at', 'updated_at']

    def get_updated_by_name(self, obj):
        if not obj.updated_by:
            return ''
        return obj.updated_by.get_full_name().strip() or obj.updated_by.username

    def validate(self, attrs):
        content_type = attrs.get(
            'content_type',
            getattr(self.instance, 'content_type', StorePage.ContentType.MARKDOWN),
        )
        errors = {}
        for field_name in ('content', 'content_en', 'content_ja', 'content_vi'):
            content = attrs.get(field_name, getattr(self.instance, field_name, ''))
            if len(content) > 100_000:
                errors[field_name] = 'Content must not exceed 100000 characters.'
            elif content_type == StorePage.ContentType.HTML:
                attrs[field_name] = sanitize_store_page_html(content)
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class AdminContactInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactInfo
        fields = [
            'phone', 'email',
            'address', 'address_en', 'address_ja', 'address_vi',
            'working_hours', 'working_hours_en', 'working_hours_ja',
            'working_hours_vi',
            'facebook_url', 'zalo_url', 'instagram_url', 'tiktok_url',
            'updated_at',
        ]
        read_only_fields = ['updated_at']


class AdminContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ['id', 'name', 'email', 'message', 'status', 'created_at', 'updated_at']
        read_only_fields = ['id', 'name', 'email', 'message', 'created_at', 'updated_at']
