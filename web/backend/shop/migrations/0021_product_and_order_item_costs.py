from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.db import migrations, models


def backfill_imported_product_costs(apps, schema_editor):
    Product = apps.get_model('shop', 'Product')
    ProductPriceHistory = apps.get_model('product_sources', 'ProductPriceHistory')
    seen_product_ids = set()

    histories = ProductPriceHistory.objects.order_by('product_id', '-created_at')
    for history in histories.iterator():
        if history.product_id in seen_product_ids:
            continue
        seen_product_ids.add(history.product_id)

        snapshot = history.calculation_snapshot or {}
        try:
            source_price_vnd = Decimal(str(snapshot['source_price_vnd']))
            source_buffer_vnd = Decimal(str(snapshot['source_buffer_vnd']))
            light_shipping_vnd = Decimal(str(snapshot['light_shipping_vnd']))
            heavy_shipping_per_kg_vnd = Decimal(
                str(snapshot['heavy_shipping_per_kg_vnd'])
            )
            heavy_weight_threshold_kg = Decimal(
                str(snapshot['heavy_weight_threshold_kg'])
            )
            product = Product.objects.only('weight').get(pk=history.product_id)
            weight = Decimal(str(product.weight))
        except (KeyError, InvalidOperation, TypeError, Product.DoesNotExist):
            continue

        shipping_vnd = (
            weight * heavy_shipping_per_kg_vnd
            if weight > heavy_weight_threshold_kg
            else light_shipping_vnd
        )
        landed_cost_vnd = (source_price_vnd + source_buffer_vnd + shipping_vnd).quantize(
            Decimal('1'),
            rounding=ROUND_HALF_UP,
        )
        Product.objects.filter(pk=history.product_id).update(
            cost_price_vnd=landed_cost_vnd
        )


class Migration(migrations.Migration):

    dependencies = [
        ('product_sources', '0001_initial'),
        ('shop', '0020_payment_webhook_event'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='cost_price_vnd',
            field=models.DecimalField(
                blank=True,
                decimal_places=0,
                help_text='Landed unit cost in VND, used for gross profit reporting.',
                max_digits=14,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='unit_cost_vnd',
            field=models.DecimalField(
                blank=True,
                decimal_places=0,
                help_text='Snapshot of the landed unit cost when the order was placed.',
                max_digits=14,
                null=True,
            ),
        ),
        migrations.RunPython(
            backfill_imported_product_costs,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
