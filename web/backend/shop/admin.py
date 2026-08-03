from django.contrib import admin

from .models import (
    AffiliateCommission,
    AffiliatePayout,
    AffiliateProfile,
    AffiliateVisit,
    Coupon,
    CouponRedemption,
)


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = (
        'code', 'discount_type', 'discount_value', 'used_count',
        'usage_limit', 'is_active', 'starts_at', 'expires_at',
    )
    list_filter = ('discount_type', 'is_active')
    search_fields = ('code', 'description')
    readonly_fields = ('used_count', 'created_at', 'updated_at')


@admin.register(CouponRedemption)
class CouponRedemptionAdmin(admin.ModelAdmin):
    list_display = ('coupon', 'user', 'order', 'discount_amount', 'created_at')
    search_fields = ('coupon__code', 'user__email')
    readonly_fields = ('coupon', 'user', 'order', 'discount_amount', 'created_at')


@admin.register(AffiliateProfile)
class AffiliateProfileAdmin(admin.ModelAdmin):
    list_display = ('code', 'user', 'status', 'commission_rate', 'cookie_days', 'created_at')
    list_filter = ('status',)
    search_fields = ('code', 'user__email', 'user__username')
    exclude = ('payout_details_encrypted',)


@admin.register(AffiliateCommission)
class AffiliateCommissionAdmin(admin.ModelAdmin):
    list_display = ('affiliate', 'order', 'status', 'base_amount', 'amount', 'available_at')
    list_filter = ('status',)
    search_fields = ('affiliate__code', 'order__id', 'order__user__email')
    readonly_fields = ('affiliate', 'order', 'base_amount', 'commission_rate', 'amount')


@admin.register(AffiliatePayout)
class AffiliatePayoutAdmin(admin.ModelAdmin):
    list_display = ('id', 'affiliate', 'status', 'total_amount', 'currency', 'paid_at')
    list_filter = ('status',)


@admin.register(AffiliateVisit)
class AffiliateVisitAdmin(admin.ModelAdmin):
    list_display = ('affiliate', 'session_id', 'landing_path', 'created_at')
    search_fields = ('affiliate__code', 'session_id')
