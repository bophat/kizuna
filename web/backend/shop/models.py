from decimal import Decimal
import re

from django.core.exceptions import ValidationError
from django.db import models
from django.contrib.auth.models import User

class Category(models.Model):
    name = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100, blank=True, default='')
    name_ja = models.CharField(max_length=100, blank=True, default='')
    name_vi = models.CharField(max_length=100, blank=True, default='')
    slug = models.SlugField(unique=True)

    def __str__(self):
        return self.name

class ProductStatus(models.TextChoices):
    DRAFT = 'draft', 'Draft'
    REVIEW = 'review', 'Review'
    PUBLISHED = 'published', 'Published'
    SUSPENDED = 'suspended', 'Suspended'


class Product(models.Model):
    id = models.CharField(max_length=100, primary_key=True)
    name = models.CharField(max_length=200)
    name_en = models.CharField(max_length=200, blank=True, default='')
    name_ja = models.CharField(max_length=200, blank=True, default='')
    name_vi = models.CharField(max_length=200, blank=True, default='')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default='USD')
    status = models.CharField(
        max_length=20,
        choices=ProductStatus.choices,
        default=ProductStatus.PUBLISHED,
        db_index=True,
    )
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='products')
    brand = models.CharField(max_length=100, null=True, blank=True)
    location = models.CharField(max_length=100, null=True, blank=True)
    description = models.TextField()
    description_en = models.TextField(blank=True, default='')
    description_ja = models.TextField(blank=True, default='')
    description_vi = models.TextField(blank=True, default='')
    image = models.ImageField(upload_to='products/', null=True, blank=True)
    
    # Flags
    is_limited = models.BooleanField(default=False)
    is_new = models.BooleanField(default=False)
    is_featured = models.BooleanField(default=False)
    is_cheap = models.BooleanField(default=False)
    
    # Stats
    likes = models.PositiveIntegerField(default=0)
    sales = models.PositiveIntegerField(default=0)
    stock = models.PositiveIntegerField(default=0)
    weight = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True, help_text="Weight in kg")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class ProductImage(models.Model):
    product = models.ForeignKey(Product, related_name='gallery', on_delete=models.CASCADE)
    image = models.ImageField(upload_to='products/gallery/')
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image for {self.product.name}"

class Cart(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='cart', null=True, blank=True)
    session_id = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        if self.user:
            return f"Cart for {self.user.username}"
        return f"Cart for session {self.session_id}"

    @property
    def total_amount(self):
        return sum(item.price * item.quantity for item in self.items.all())

class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, null=True, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    class Meta:
        unique_together = ('cart', 'product')

    def __str__(self):
        return f"{self.quantity} x {self.product.name}"

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone = models.CharField(max_length=20, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    points = models.PositiveIntegerField(default=0)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)

    def __str__(self):
        return f"Profile for {self.user.username}"


class AffiliateProfile(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending approval'
        ACTIVE = 'active', 'Active'
        SUSPENDED = 'suspended', 'Suspended'

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='affiliate_profile'
    )
    code = models.CharField(max_length=40, unique=True, db_index=True)
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    commission_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('5.00')
    )
    cookie_days = models.PositiveSmallIntegerField(default=30)
    payout_details_encrypted = models.TextField(blank=True, default='')
    internal_notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_affiliates',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def clean(self):
        errors = {}
        normalized_code = str(self.code or '').strip().upper()
        if not re.fullmatch(r'[A-Z0-9_-]{2,40}', normalized_code):
            errors['code'] = 'Use 2-40 letters, numbers, underscores or hyphens.'
        if self.commission_rate is not None and not Decimal('0') <= self.commission_rate <= Decimal('100'):
            errors['commission_rate'] = 'Commission rate must be between 0 and 100.'
        if self.cookie_days is not None and not 1 <= self.cookie_days <= 365:
            errors['cookie_days'] = 'Cookie duration must be between 1 and 365 days.'
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.code} - {self.user.get_full_name() or self.user.username}'


class Coupon(models.Model):
    class DiscountType(models.TextChoices):
        PERCENTAGE = 'percentage', 'Percentage'
        FIXED = 'fixed', 'Fixed amount'

    code = models.CharField(max_length=50, unique=True, db_index=True)
    description = models.CharField(max_length=255, blank=True, default='')
    discount_type = models.CharField(max_length=12, choices=DiscountType.choices)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    minimum_order_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00')
    )
    maximum_discount_amount = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    usage_limit = models.PositiveIntegerField(null=True, blank=True)
    per_user_limit = models.PositiveIntegerField(default=1)
    used_count = models.PositiveIntegerField(default=0)
    starts_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_coupons',
    )
    affiliate = models.ForeignKey(
        AffiliateProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='coupons',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def clean(self):
        errors = {}
        if self.discount_value is not None and self.discount_value <= 0:
            errors['discount_value'] = 'Discount value must be greater than zero.'
        if (
            self.discount_type == self.DiscountType.PERCENTAGE
            and self.discount_value is not None
            and self.discount_value > 100
        ):
            errors['discount_value'] = 'Percentage discount cannot exceed 100.'
        if self.minimum_order_amount is not None and self.minimum_order_amount < 0:
            errors['minimum_order_amount'] = 'Minimum order amount cannot be negative.'
        if (
            self.maximum_discount_amount is not None
            and self.maximum_discount_amount <= 0
        ):
            errors['maximum_discount_amount'] = 'Maximum discount must be greater than zero.'
        if self.usage_limit is not None and self.usage_limit < 1:
            errors['usage_limit'] = 'Usage limit must be at least one.'
        if self.per_user_limit is not None and self.per_user_limit < 1:
            errors['per_user_limit'] = 'Per-user limit must be at least one.'
        if self.starts_at and self.expires_at and self.starts_at >= self.expires_at:
            errors['expires_at'] = 'Expiry time must be after the start time.'
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.code

class Order(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
    )
    PAYMENT_CHOICES = (
        ('cod', 'Cash on delivery'),
        ('bank_transfer', 'Bank transfer'),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    payment_method = models.CharField(max_length=20, choices=PAYMENT_CHOICES)
    subtotal_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    shipping_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    coupon = models.ForeignKey(
        Coupon,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
    )
    coupon_code = models.CharField(max_length=50, blank=True, default='')
    affiliate = models.ForeignKey(
        AffiliateProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
    )
    affiliate_code = models.CharField(max_length=40, blank=True, default='')
    affiliate_attribution_source = models.CharField(max_length=12, blank=True, default='')
    affiliate_commission_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('0.00')
    )
    payment_receipt = models.ImageField(upload_to='receipts/', null=True, blank=True)
    admin_notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Order #{self.id} by {self.user.username}"


class PaymentMethodConfig(models.Model):
    class Code(models.TextChoices):
        COD = 'cod', 'Cash on delivery'
        BANK_TRANSFER = 'bank_transfer', 'Bank transfer'

    code = models.CharField(max_length=30, choices=Code.choices, unique=True)
    enabled = models.BooleanField(default=False, db_index=True)
    instructions_en = models.TextField(blank=True, default='')
    instructions_ja = models.TextField(blank=True, default='')
    instructions_vi = models.TextField(blank=True, default='')
    bank_name = models.CharField(max_length=120, blank=True, default='')
    bank_bin = models.CharField(max_length=12, blank=True, default='')
    account_name = models.CharField(max_length=150, blank=True, default='')
    account_number = models.CharField(max_length=50, blank=True, default='')
    currency = models.CharField(max_length=3, default='VND')
    expiry_minutes = models.PositiveIntegerField(default=60)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'code']

    def clean(self):
        errors = {}
        if self.expiry_minutes < 5 or self.expiry_minutes > 10080:
            errors['expiry_minutes'] = 'Payment expiry must be between 5 minutes and 7 days.'
        if self.enabled and self.code == self.Code.BANK_TRANSFER:
            if self.currency != 'VND':
                errors['currency'] = 'Manual bank transfer currently supports VND only.'
            for field in ('bank_name', 'bank_bin', 'account_name', 'account_number'):
                if not str(getattr(self, field, '') or '').strip():
                    errors[field] = 'This field is required when bank transfer is enabled.'
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.currency = str(self.currency or 'VND').strip().upper()
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.get_code_display()


class PaymentTransaction(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending payment'
        PROOF_SUBMITTED = 'proof_submitted', 'Proof submitted'
        PAID = 'paid', 'Paid'
        FAILED = 'failed', 'Failed'
        EXPIRED = 'expired', 'Expired'
        REFUNDED = 'refunded', 'Refunded'
        COD_PENDING = 'cod_pending', 'Collect on delivery'
        COD_COLLECTED = 'cod_collected', 'COD collected'

    order = models.OneToOneField(
        Order, on_delete=models.CASCADE, related_name='payment'
    )
    method = models.CharField(max_length=30, choices=PaymentMethodConfig.Code.choices)
    provider = models.CharField(max_length=30, default='manual')
    status = models.CharField(
        max_length=20, choices=Status.choices, db_index=True
    )
    amount_usd = models.DecimalField(max_digits=12, decimal_places=2)
    settlement_amount = models.DecimalField(max_digits=14, decimal_places=0)
    settlement_currency = models.CharField(max_length=3, default='VND')
    exchange_rate = models.DecimalField(max_digits=14, decimal_places=4)
    reference = models.CharField(max_length=50, unique=True)
    method_snapshot = models.JSONField(default=dict, blank=True)
    receipt = models.ImageField(upload_to='payment_receipts/', null=True, blank=True)
    proof_submitted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    paid_at = models.DateTimeField(null=True, blank=True, db_index=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_payments',
    )
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)
    failure_reason = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.reference} - {self.status}'

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
    product_name = models.CharField(max_length=200, null=True, blank=True) # Backup in case product is deleted
    quantity = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.quantity} x {self.product_name} (Order #{self.order.id})"


class CouponRedemption(models.Model):
    coupon = models.ForeignKey(
        Coupon, on_delete=models.PROTECT, related_name='redemptions'
    )
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='coupon_redemptions'
    )
    order = models.OneToOneField(
        Order, on_delete=models.CASCADE, related_name='coupon_redemption'
    )
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.coupon.code} - Order #{self.order_id}'


class AffiliateVisit(models.Model):
    affiliate = models.ForeignKey(
        AffiliateProfile, on_delete=models.CASCADE, related_name='visits'
    )
    session_id = models.CharField(max_length=64)
    landing_path = models.CharField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['affiliate', 'session_id'], name='unique_affiliate_visit_session'
            )
        ]


class AffiliatePayout(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PAID = 'paid', 'Paid'
        CANCELLED = 'cancelled', 'Cancelled'

    affiliate = models.ForeignKey(
        AffiliateProfile, on_delete=models.PROTECT, related_name='payouts'
    )
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.DRAFT, db_index=True
    )
    currency = models.CharField(max_length=3, default='USD')
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    payout_details_encrypted = models.TextField(blank=True, default='')
    transaction_reference = models.CharField(max_length=100, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_affiliate_payouts',
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']


class AffiliateCommission(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        AVAILABLE = 'available', 'Available'
        PAID = 'paid', 'Paid'
        REVERSED = 'reversed', 'Reversed'

    affiliate = models.ForeignKey(
        AffiliateProfile, on_delete=models.PROTECT, related_name='commissions'
    )
    order = models.OneToOneField(
        Order, on_delete=models.CASCADE, related_name='affiliate_commission'
    )
    payout = models.ForeignKey(
        AffiliatePayout,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='commissions',
    )
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    base_amount = models.DecimalField(max_digits=12, decimal_places=2)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    available_at = models.DateTimeField(null=True, blank=True, db_index=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    reversed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.affiliate.code} - Order #{self.order_id} - {self.amount}'

class Favorite(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='favorites')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='favorited_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'product')

    def __str__(self):
        return f"{self.user.username} favorites {self.product.name}"


class ConciergeSession(models.Model):
    session_id = models.CharField(max_length=128, unique=True, db_index=True)
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='concierge_sessions',
    )
    admin_took_over = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def customer_name(self):
        if not self.user_id:
            return ''
        return self.user.get_full_name().strip() or self.user.username

    def __str__(self):
        return self.session_id


class ConciergeMessage(models.Model):
    class Role(models.TextChoices):
        USER = 'user', 'User'
        ASSISTANT = 'assistant', 'Assistant'

    session = models.ForeignKey(
        ConciergeSession, on_delete=models.CASCADE, related_name='messages'
    )
    role = models.CharField(max_length=16, choices=Role.choices)
    content = models.TextField()
    is_admin = models.BooleanField(default=False)
    is_ai = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.session.session_id}: {self.role}'


class StorePage(models.Model):
    class ContentType(models.TextChoices):
        MARKDOWN = 'markdown', 'Markdown'
        HTML = 'html', 'HTML'

    slug = models.SlugField(max_length=50, unique=True)
    title = models.CharField(max_length=255)
    title_en = models.CharField(max_length=255, blank=True, default='')
    title_ja = models.CharField(max_length=255, blank=True, default='')
    title_vi = models.CharField(max_length=255, blank=True, default='')
    content = models.TextField(blank=True, default='')
    content_en = models.TextField(blank=True, default='')
    content_ja = models.TextField(blank=True, default='')
    content_vi = models.TextField(blank=True, default='')
    content_type = models.CharField(
        max_length=10,
        choices=ContentType.choices,
        default=ContentType.MARKDOWN,
    )
    is_published = models.BooleanField(default=True)
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_store_pages',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return self.title


class ContactInfo(models.Model):
    phone = models.CharField(max_length=30, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    address = models.TextField(blank=True, default='')
    address_en = models.TextField(blank=True, default='')
    address_ja = models.TextField(blank=True, default='')
    address_vi = models.TextField(blank=True, default='')
    working_hours = models.CharField(max_length=255, blank=True, default='')
    working_hours_en = models.CharField(max_length=255, blank=True, default='')
    working_hours_ja = models.CharField(max_length=255, blank=True, default='')
    working_hours_vi = models.CharField(max_length=255, blank=True, default='')
    facebook_url = models.URLField(max_length=500, blank=True, default='')
    zalo_url = models.URLField(max_length=500, blank=True, default='')
    instagram_url = models.URLField(max_length=500, blank=True, default='')
    tiktok_url = models.URLField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.email or self.phone or 'Store contact information'


class ContactMessage(models.Model):
    class Status(models.TextChoices):
        UNREAD = 'unread', 'Unread'
        READ = 'read', 'Read'
        REPLIED = 'replied', 'Replied'

    name = models.CharField(max_length=100)
    email = models.EmailField()
    message = models.TextField()
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.UNREAD,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} <{self.email}>'
