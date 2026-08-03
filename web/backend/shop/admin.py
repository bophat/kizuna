from django.contrib import admin

from .models import Coupon, CouponRedemption


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
