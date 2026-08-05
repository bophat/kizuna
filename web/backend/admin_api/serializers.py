from datetime import date
from decimal import Decimal

from rest_framework import serializers
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
    OrderItem,
    Product,
    ProductImage,
    StorePage,
    UserProfile,
)
from shop.content_sanitizer import sanitize_store_page_html
from django.contrib.auth.models import User
from .models import (
    MarketingCampaign,
    PendingReply,
    Setting,
    TrendingProductLead,
)
from .secrets import (
    expose_setting_for_api,
    is_secret_setting_key,
    prepare_setting_for_storage,
)
from shop.image_urls import resolve_image_url, resolve_product_image_url
from shop.affiliate_payout_details import encrypt_payout_details, masked_payout_details

class UserSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(source='profile.phone', required=False, allow_null=True, allow_blank=True)
    address = serializers.CharField(source='profile.address', required=False, allow_null=True, allow_blank=True)
    date_of_birth = serializers.DateField(source='profile.date_of_birth', required=False, allow_null=True)
    preferred_language = serializers.ChoiceField(
        source='profile.preferred_language',
        choices=UserProfile.PreferredLanguage.choices,
        required=False,
    )
    birthday_email_enabled = serializers.BooleanField(
        source='profile.birthday_email_enabled',
        required=False,
    )
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'is_staff',
            'is_superuser', 'password', 'phone', 'address', 'date_of_birth',
            'preferred_language', 'birthday_email_enabled', 'date_joined',
        ]

    def validate_date_of_birth(self, value):
        if value and value > date.today():
            raise serializers.ValidationError('Date of birth cannot be in the future.')
        return value

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
    affiliate_code = serializers.CharField(source='affiliate.code', read_only=True)
    assigned_user_email = serializers.EmailField(
        source='assigned_user.email', read_only=True
    )

    class Meta:
        model = Coupon
        fields = [
            'id', 'code', 'description', 'discount_type', 'discount_value',
            'amount_currency', 'minimum_order_amount',
            'maximum_discount_amount', 'usage_limit',
            'per_user_limit', 'used_count', 'starts_at', 'expires_at',
            'is_active', 'created_by_name', 'created_at', 'updated_at',
            'affiliate', 'affiliate_code',
            'source', 'birthday_year', 'assigned_user', 'assigned_user_email',
        ]
        read_only_fields = [
            'id', 'used_count', 'created_by_name', 'created_at', 'updated_at',
            'source', 'birthday_year', 'assigned_user', 'assigned_user_email',
        ]

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return ''
        return obj.created_by.get_full_name().strip() or obj.created_by.username

    def validate_code(self, value):
        import re

        code = value.strip().upper()
        if not re.fullmatch(r'[A-Z0-9_-]{2,40}', code):
            raise serializers.ValidationError(
                'Use 2-40 letters, numbers, underscores or hyphens.'
            )
        queryset = Coupon.objects.filter(code__iexact=code)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('A coupon with this code already exists.')
        return code

    def validate(self, attrs):
        if self.instance and self.instance.source == Coupon.Source.BIRTHDAY:
            protected_fields = set(attrs) - {'is_active'}
            if protected_fields:
                raise serializers.ValidationError(
                    'Birthday coupon terms are generated automatically. '
                    'Only the active status can be changed.'
                )

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


class AffiliateProfileSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    visits_count = serializers.SerializerMethodField()
    orders_count = serializers.SerializerMethodField()
    pending_amount = serializers.SerializerMethodField()
    available_amount = serializers.SerializerMethodField()
    paid_amount = serializers.SerializerMethodField()
    payout_details = serializers.SerializerMethodField()
    bank_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    account_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    account_number = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = AffiliateProfile
        fields = [
            'id', 'user', 'user_details', 'code', 'status', 'commission_rate',
            'cookie_days', 'internal_notes', 'visits_count', 'orders_count',
            'pending_amount', 'available_amount', 'paid_amount', 'payout_details',
            'bank_name', 'account_name', 'account_number', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'visits_count', 'orders_count', 'pending_amount',
            'available_amount', 'paid_amount', 'payout_details',
            'created_at', 'updated_at',
        ]

    def validate_code(self, value):
        code = value.strip().upper()
        queryset = AffiliateProfile.objects.filter(code__iexact=code)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('This affiliate code is already in use.')
        return code

    def validate_user(self, value):
        queryset = AffiliateProfile.objects.filter(user=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('This user is already an affiliate.')
        return value

    def validate(self, attrs):
        rate = attrs.get('commission_rate', getattr(self.instance, 'commission_rate', 0))
        cookie_days = attrs.get('cookie_days', getattr(self.instance, 'cookie_days', 30))
        errors = {}
        if rate < 0 or rate > 100:
            errors['commission_rate'] = 'Commission rate must be between 0 and 100.'
        if cookie_days < 1 or cookie_days > 365:
            errors['cookie_days'] = 'Cookie duration must be between 1 and 365 days.'
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def _save_payout_details(self, validated_data, instance=None):
        details = {
            field: validated_data.pop(field, '')
            for field in ('bank_name', 'account_name', 'account_number')
        }
        if details['account_number']:
            validated_data['payout_details_encrypted'] = encrypt_payout_details(details)
        elif instance:
            validated_data['payout_details_encrypted'] = instance.payout_details_encrypted
        return validated_data

    def create(self, validated_data):
        return super().create(self._save_payout_details(validated_data))

    def update(self, instance, validated_data):
        return super().update(instance, self._save_payout_details(validated_data, instance))

    def get_visits_count(self, obj):
        return obj.visits.count()

    def get_orders_count(self, obj):
        return obj.commissions.count()

    def _total(self, obj, status_code):
        return sum(
            (
                commission.amount
                for commission in obj.commissions.all()
                if commission.status == status_code
                and not (
                    status_code == AffiliateCommission.Status.AVAILABLE
                    and commission.payout_id
                )
            ),
            Decimal('0.00'),
        )

    def get_pending_amount(self, obj):
        return self._total(obj, AffiliateCommission.Status.PENDING)

    def get_available_amount(self, obj):
        return self._total(obj, AffiliateCommission.Status.AVAILABLE)

    def get_paid_amount(self, obj):
        return self._total(obj, AffiliateCommission.Status.PAID)

    def get_payout_details(self, obj):
        return masked_payout_details(obj.payout_details_encrypted)


class AffiliateCommissionSerializer(serializers.ModelSerializer):
    affiliate_code = serializers.CharField(source='affiliate.code', read_only=True)
    customer_email = serializers.EmailField(source='order.user.email', read_only=True)

    class Meta:
        model = AffiliateCommission
        fields = [
            'id', 'affiliate', 'affiliate_code', 'order', 'customer_email',
            'status', 'base_amount', 'commission_rate', 'amount', 'payout',
            'available_at', 'paid_at', 'reversed_at', 'created_at', 'updated_at',
        ]
        read_only_fields = fields


class AffiliatePayoutSerializer(serializers.ModelSerializer):
    affiliate_code = serializers.CharField(source='affiliate.code', read_only=True)
    commission_count = serializers.SerializerMethodField()
    payout_details = serializers.SerializerMethodField()

    class Meta:
        model = AffiliatePayout
        fields = [
            'id', 'affiliate', 'affiliate_code', 'status', 'currency',
            'total_amount', 'commission_count', 'transaction_reference',
            'payout_details', 'notes', 'paid_at', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'affiliate', 'affiliate_code', 'status', 'currency',
            'total_amount', 'commission_count', 'payout_details', 'paid_at',
            'created_at', 'updated_at',
        ]

    def get_commission_count(self, obj):
        return obj.commissions.count()

    def get_payout_details(self, obj):
        return masked_payout_details(obj.payout_details_encrypted)

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    class Meta:
        model = Product
        fields = [
            'id', 'name', 'name_en', 'name_ja', 'name_vi',
            'price', 'cost_price_vnd', 'currency', 'category', 'category_name',
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
        fields = [
            'id', 'order', 'product', 'product_name', 'quantity', 'price',
            'unit_cost_vnd', 'product_details',
        ]
        read_only_fields = ['id', 'product_details']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    user_details = UserSerializer(source='user', read_only=True)
    order_code = serializers.CharField(read_only=True)
    payment_receipt = serializers.SerializerMethodField()
    payment = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = '__all__'

    def get_payment_receipt(self, obj):
        receipt = None
        try:
            receipt = obj.payment.receipt
        except PaymentTransaction.DoesNotExist:
            receipt = obj.payment_receipt
        if receipt:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(receipt.url)
            return receipt.url
        return None

    def get_payment(self, obj):
        try:
            return PaymentTransactionAdminSerializer(
                obj.payment, context=self.context
            ).data
        except PaymentTransaction.DoesNotExist:
            return None


class PaymentTransactionAdminSerializer(serializers.ModelSerializer):
    receipt_url = serializers.SerializerMethodField()
    verified_by_email = serializers.EmailField(
        source='verified_by.email', read_only=True
    )

    class Meta:
        model = PaymentTransaction
        fields = [
            'id', 'method', 'provider', 'status', 'amount_usd',
            'settlement_amount', 'settlement_currency', 'exchange_rate',
            'reference', 'method_snapshot', 'receipt_url', 'proof_submitted_at',
            'paid_at', 'verified_at', 'verified_by_email', 'expires_at',
            'failure_reason', 'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_receipt_url(self, obj):
        if not obj.receipt:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(obj.receipt.url) if request else obj.receipt.url


class PaymentMethodConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethodConfig
        fields = [
            'id', 'code', 'enabled', 'instructions_en', 'instructions_ja',
            'instructions_vi', 'bank_name', 'bank_bin', 'account_name',
            'account_number', 'currency', 'expiry_minutes', 'sort_order',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'code', 'created_at', 'updated_at']

    def validate(self, attrs):
        instance = self.instance
        code = instance.code if instance else attrs.get('code')
        enabled = attrs.get('enabled', getattr(instance, 'enabled', False))
        expiry = attrs.get('expiry_minutes', getattr(instance, 'expiry_minutes', 60))
        errors = {}
        if expiry < 5 or expiry > 10080:
            errors['expiry_minutes'] = 'Payment expiry must be between 5 minutes and 7 days.'
        if enabled and code == PaymentMethodConfig.Code.BANK_TRANSFER:
            currency = attrs.get('currency', getattr(instance, 'currency', 'VND'))
            if str(currency or '').upper() != 'VND':
                errors['currency'] = 'Manual bank transfer currently supports VND only.'
            for field in ('bank_name', 'bank_bin', 'account_name', 'account_number'):
                value = attrs.get(field, getattr(instance, field, '') if instance else '')
                if not str(value or '').strip():
                    errors[field] = 'This field is required when bank transfer is enabled.'
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

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


class MarketingCampaignSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_image = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = MarketingCampaign
        fields = [
            'id', 'name', 'campaign_type', 'product', 'product_name',
            'product_image', 'subject', 'body', 'cta_text', 'cta_url',
            'image_url', 'status', 'recipient_count', 'sent_count',
            'failed_count', 'created_by_name', 'started_at', 'completed_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'status', 'recipient_count', 'sent_count', 'failed_count',
            'created_by_name', 'started_at', 'completed_at', 'created_at',
            'updated_at',
        ]

    def get_product_image(self, obj):
        if not obj.product:
            return ''
        return resolve_product_image_url(obj.product, self.context.get('request'))

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return ''
        return obj.created_by.get_full_name().strip() or obj.created_by.username

    def validate(self, attrs):
        if self.instance and self.instance.status != MarketingCampaign.Status.DRAFT:
            raise serializers.ValidationError(
                'A campaign cannot be edited after sending has started.'
            )
        campaign_type = attrs.get(
            'campaign_type',
            getattr(self.instance, 'campaign_type', MarketingCampaign.CampaignType.EVENT),
        )
        product = attrs.get('product', getattr(self.instance, 'product', None))
        if campaign_type == MarketingCampaign.CampaignType.PRODUCT and not product:
            raise serializers.ValidationError(
                {'product': 'Select a product for a product campaign.'}
            )
        return attrs


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
