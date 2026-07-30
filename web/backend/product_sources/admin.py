from django.contrib import admin

from product_sources.models import (
    ProductPriceHistory,
    ProductSource,
    SourceAuditLog,
    SourceCategoryMapping,
    SourceImportJob,
)


@admin.register(ProductSource)
class ProductSourceAdmin(admin.ModelAdmin):
    list_display = (
        'product_id', 'provider', 'source_product_id', 'sync_status', 'last_synced_at',
    )
    list_filter = ('provider', 'sync_status', 'source_availability')
    search_fields = ('product_id', 'source_product_id', 'canonical_url')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(ProductPriceHistory)
class ProductPriceHistoryAdmin(admin.ModelAdmin):
    list_display = ('product_id', 'source_price_jpy', 'calculated_price_usd', 'created_at')
    search_fields = ('product_id', 'source__source_product_id')
    readonly_fields = ('created_at',)


@admin.register(SourceImportJob)
class SourceImportJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'job_type', 'status', 'dry_run', 'total', 'succeeded', 'failed')
    list_filter = ('job_type', 'status', 'dry_run', 'provider')
    readonly_fields = ('created_at', 'started_at', 'finished_at')


@admin.register(SourceCategoryMapping)
class SourceCategoryMappingAdmin(admin.ModelAdmin):
    list_display = ('provider', 'source_category', 'target_category')
    list_filter = ('provider',)
    search_fields = ('source_category', 'target_category__name')


@admin.register(SourceAuditLog)
class SourceAuditLogAdmin(admin.ModelAdmin):
    list_display = ('action', 'product_id', 'provider', 'actor', 'created_at')
    list_filter = ('action', 'provider', 'dry_run')
    search_fields = ('product_id', 'source_product_id')
    readonly_fields = (
        'action', 'actor', 'product_id', 'provider', 'source_product_id', 'dry_run',
        'input_summary', 'result_summary', 'created_at',
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
