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


class ManualProductInputSerializer(serializers.Serializer):
    source_url = serializers.URLField(max_length=1000)
    sku = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, max_length=80,
    )
    name = serializers.CharField(max_length=200)
    description = serializers.CharField(
        required=False, allow_blank=True, default='', max_length=10_000,
    )
    source_price_jpy = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=0,
    )
    category_id = serializers.IntegerField(min_value=1)
    weight_kg = serializers.DecimalField(
        max_digits=6, decimal_places=2, default=0.30, min_value=0,
    )
    stock = serializers.IntegerField(default=1, min_value=0)
    brand = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, max_length=100,
    )
    location = serializers.CharField(
        required=False, allow_blank=True, allow_null=True,
        default='Japan', max_length=100,
    )
    image_url = serializers.URLField(
        required=False, allow_blank=True, allow_null=True, max_length=1500,
    )
    is_new = serializers.BooleanField(default=True)
    is_limited = serializers.BooleanField(default=False)
    is_featured = serializers.BooleanField(default=False)
    is_cheap = serializers.BooleanField(default=False)


class ManualBulkSerializer(serializers.Serializer):
    items = ManualProductInputSerializer(many=True, min_length=1, max_length=50)
    image_mode = serializers.ChoiceField(
        choices=ImageMode.choices,
        default=ImageMode.REMOTE,
    )

    def validate_items(self, items):
        urls = [item['source_url'].rstrip('/') for item in items]
        if len(urls) != len(set(urls)):
            raise serializers.ValidationError(
                'Mỗi URL nguồn chỉ được xuất hiện một lần trong một batch.',
            )
        return items


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
