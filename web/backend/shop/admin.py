from django.contrib import admin

from .models import (
    AffiliateCommission,
    AffiliatePayout,
    AffiliateProfile,
    AffiliateVisit,
    Coupon,
    CouponRedemption,
    PaymentWebhookEvent,
    InvoiceSettings,
)


@admin.register(InvoiceSettings)
class InvoiceSettingsAdmin(admin.ModelAdmin):
    list_display = ('company_name', 'is_active', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('company_name', 'company_name_ja', 'company_name_vi', 'tax_id')
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        ('Basic Info', {
            'fields': ('company_name', 'company_name_ja', 'company_name_vi', 'logo', 'is_active')
        }),
        ('Address & Contact', {
            'fields': ('address', 'address_ja', 'address_vi', 'phone', 'email', 'tax_id')
        }),
        ('Bank Info', {
            'fields': ('bank_info', 'bank_info_ja', 'bank_info_vi'),
            'classes': ('collapse',)
        }),
        ('Footer', {
            'fields': ('footer_text', 'footer_text_ja', 'footer_text_vi'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def has_add_permission(self, request):
        # Only allow one active invoice settings
        if InvoiceSettings.objects.filter(is_active=True).exists():
            return False
        return super().has_add_permission(request)


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


@admin.register(PaymentWebhookEvent)
class PaymentWebhookEventAdmin(admin.ModelAdmin):
    list_display = ('provider', 'event_id', 'payment', 'status', 'reason', 'created_at')
    list_filter = ('provider', 'status')
    search_fields = ('event_id', 'payment__reference', 'reason')
    readonly_fields = (
        'provider', 'event_id', 'payment', 'status', 'reason',
        'payload', 'processed_at', 'created_at',
    )
