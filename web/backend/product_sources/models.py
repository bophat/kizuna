import hashlib
import json

from django.conf import settings
from django.db import models

from .enums import (
    ImportJobStatus,
    ImportJobType,
    SourceAvailability,
    SourceProvider,
    SourceSyncStatus,
)
from .security import redact_sensitive_data


class ProductSource(models.Model):
    product = models.OneToOneField(
        'shop.Product',
        on_delete=models.CASCADE,
        related_name='source_info',
    )
    provider = models.CharField(max_length=30, choices=SourceProvider.choices)
    source_product_id = models.CharField(max_length=120)
    source_url = models.URLField(max_length=1000)
    canonical_url = models.URLField(max_length=1000)

    source_price_jpy = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
    )
    source_currency = models.CharField(max_length=10, default='JPY')
    source_availability = models.CharField(
        max_length=20,
        choices=SourceAvailability.choices,
        default=SourceAvailability.UNKNOWN,
    )
    source_stock_quantity = models.PositiveIntegerField(null=True, blank=True)

    external_image_url = models.URLField(max_length=1500, null=True, blank=True)
    affiliate_url = models.URLField(max_length=1500, null=True, blank=True)
    raw_data = models.JSONField(default=dict, blank=True)
    data_hash = models.CharField(max_length=64, null=True, blank=True)

    fetched_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(null=True, blank=True)
    sync_status = models.CharField(
        max_length=20,
        choices=SourceSyncStatus.choices,
        default=SourceSyncStatus.NEVER,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['provider', 'source_product_id'],
                name='uq_product_source_provider_product_id',
            ),
        ]
        indexes = [
            models.Index(fields=['provider', 'sync_status']),
            models.Index(fields=['last_synced_at']),
        ]

    @staticmethod
    def compute_data_hash(data: dict) -> str:
        safe = redact_sensitive_data(data)
        payload = json.dumps(safe, sort_keys=True, default=str)
        return hashlib.sha256(payload.encode()).hexdigest()


class ProductPriceHistory(models.Model):
    product = models.ForeignKey(
        'shop.Product',
        on_delete=models.CASCADE,
        related_name='price_history',
    )
    source = models.ForeignKey(
        ProductSource,
        on_delete=models.CASCADE,
        related_name='price_history',
    )
    source_price_jpy = models.DecimalField(max_digits=14, decimal_places=2)
    calculated_price_usd = models.DecimalField(max_digits=12, decimal_places=2)
    previous_product_price_usd = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
    )
    calculation_snapshot = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)


class SourceImportJob(models.Model):
    job_type = models.CharField(max_length=20, choices=ImportJobType.choices)
    provider = models.CharField(max_length=30, blank=True)
    status = models.CharField(
        max_length=20,
        choices=ImportJobStatus.choices,
        default=ImportJobStatus.PENDING,
    )
    dry_run = models.BooleanField(default=False)
    total = models.PositiveIntegerField(default=0)
    succeeded = models.PositiveIntegerField(default=0)
    failed = models.PositiveIntegerField(default=0)
    payload = models.JSONField(default=dict)
    result = models.JSONField(default=dict)
    error = models.TextField(blank=True)
    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)


class SourceCategoryMapping(models.Model):
    provider = models.CharField(max_length=30)
    source_category = models.CharField(max_length=500)
    target_category = models.ForeignKey(
        'shop.Category',
        on_delete=models.CASCADE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['provider', 'source_category'],
                name='uq_source_category_mapping',
            ),
        ]


class SourceAuditLog(models.Model):
    action = models.CharField(max_length=100)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    product_id = models.CharField(max_length=100, blank=True)
    provider = models.CharField(max_length=30, blank=True)
    source_product_id = models.CharField(max_length=120, blank=True)
    dry_run = models.BooleanField(default=False)
    input_summary = models.JSONField(default=dict)
    result_summary = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
