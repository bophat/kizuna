from decimal import Decimal

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def copy_existing_order_totals(apps, schema_editor):
    Order = apps.get_model('shop', 'Order')
    Order.objects.update(subtotal_amount=models.F('total_amount'))


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('shop', '0015_localized_store_pages_contact_info'),
    ]

    operations = [
        migrations.CreateModel(
            name='Coupon',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(db_index=True, max_length=50, unique=True)),
                ('description', models.CharField(blank=True, default='', max_length=255)),
                ('discount_type', models.CharField(choices=[('percentage', 'Percentage'), ('fixed', 'Fixed amount')], max_length=12)),
                ('discount_value', models.DecimalField(decimal_places=2, max_digits=10)),
                ('minimum_order_amount', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=10)),
                ('maximum_discount_amount', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('usage_limit', models.PositiveIntegerField(blank=True, null=True)),
                ('per_user_limit', models.PositiveIntegerField(default=1)),
                ('used_count', models.PositiveIntegerField(default=0)),
                ('starts_at', models.DateTimeField(blank=True, null=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_coupons', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.AddField(
            model_name='order',
            name='coupon',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='orders', to='shop.coupon'),
        ),
        migrations.AddField(
            model_name='order',
            name='coupon_code',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
        migrations.AddField(
            model_name='order',
            name='discount_amount',
            field=models.DecimalField(decimal_places=2, default=0.0, max_digits=10),
        ),
        migrations.AddField(
            model_name='order',
            name='shipping_amount',
            field=models.DecimalField(decimal_places=2, default=0.0, max_digits=10),
        ),
        migrations.AddField(
            model_name='order',
            name='subtotal_amount',
            field=models.DecimalField(decimal_places=2, default=0.0, max_digits=10),
        ),
        migrations.RunPython(copy_existing_order_totals, migrations.RunPython.noop),
        migrations.CreateModel(
            name='CouponRedemption',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('discount_amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('coupon', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='redemptions', to='shop.coupon')),
                ('order', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='coupon_redemption', to='shop.order')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='coupon_redemptions', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
    ]
