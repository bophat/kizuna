from rest_framework import serializers
from product_sources.enums import ImageMode


class PreviewImportSerializer(serializers.Serializer):
    url = serializers.URLField(required=True)
    category_id = serializers.IntegerField(required=False, allow_null=True)
    default_weight_kg = serializers.DecimalField(
        max_digits=6, decimal_places=2, default=0.30, allow_null=True, min_value=0,
    )
    default_stock = serializers.IntegerField(default=1, min_value=0)
    image_mode = serializers.ChoiceField(choices=ImageMode.choices, default=ImageMode.SKIP)


class ImportSourceProductSerializer(PreviewImportSerializer):
    dry_run = serializers.BooleanField(default=False)


class BulkImportSerializer(serializers.Serializer):
    urls = serializers.ListField(child=serializers.URLField(), min_length=1, max_length=50)
    category_id = serializers.IntegerField(required=False, allow_null=True)
    default_weight_kg = serializers.DecimalField(
        max_digits=6, decimal_places=2, default=0.30, allow_null=True, min_value=0,
    )
    default_stock = serializers.IntegerField(default=1, min_value=0)
    image_mode = serializers.ChoiceField(choices=ImageMode.choices, default=ImageMode.SKIP)
    dry_run = serializers.BooleanField(default=True)


class SyncSourceSerializer(serializers.Serializer):
    update_product_price = serializers.BooleanField(default=False)
    update_stock = serializers.BooleanField(default=True)
    dry_run = serializers.BooleanField(default=True)


class BulkSyncSerializer(SyncSourceSerializer):
    provider = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    product_ids = serializers.ListField(
        child=serializers.CharField(max_length=100), required=False, default=list,
    )
    limit = serializers.IntegerField(default=100, min_value=1, max_value=1000)
