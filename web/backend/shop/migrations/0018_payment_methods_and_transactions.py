from decimal import Decimal

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def seed_payment_methods_and_normalize_orders(apps, schema_editor):
    Order = apps.get_model('shop', 'Order')
    PaymentMethodConfig = apps.get_model('shop', 'PaymentMethodConfig')

    Order.objects.filter(payment_method='cash').update(payment_method='cod')
    Order.objects.filter(payment_method='transfer').update(payment_method='bank_transfer')

    PaymentMethodConfig.objects.update_or_create(
        code='cod',
        defaults={
            'enabled': True,
            'instructions_en': 'Pay the delivery staff when your order arrives.',
            'instructions_ja': '商品のお届け時に配達員へお支払いください。',
            'instructions_vi': 'Thanh toán cho nhân viên giao hàng khi nhận được sản phẩm.',
            'currency': 'VND',
            'expiry_minutes': 1440,
            'sort_order': 10,
        },
    )
    PaymentMethodConfig.objects.update_or_create(
        code='bank_transfer',
        defaults={
            'enabled': False,
            'instructions_en': 'Transfer the exact amount and upload your receipt for verification.',
            'instructions_ja': '正確な金額を振り込み、確認用の領収書をアップロードしてください。',
            'instructions_vi': 'Chuyển đúng số tiền và tải biên lai để được xác nhận.',
            'currency': 'VND',
            'expiry_minutes': 60,
            'sort_order': 20,
        },
    )


def restore_legacy_order_methods(apps, schema_editor):
    Order = apps.get_model('shop', 'Order')
    Order.objects.filter(payment_method='cod').update(payment_method='cash')
    Order.objects.filter(payment_method='bank_transfer').update(payment_method='transfer')


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('shop', '0017_affiliate_commissions_and_payouts'),
    ]

    operations = [
        migrations.AlterField(
            model_name='order',
            name='payment_method',
            field=models.CharField(
                choices=[
                    ('cod', 'Cash on delivery'),
                    ('bank_transfer', 'Bank transfer'),
                ],
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name='PaymentMethodConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(choices=[('cod', 'Cash on delivery'), ('bank_transfer', 'Bank transfer')], max_length=30, unique=True)),
                ('enabled', models.BooleanField(db_index=True, default=False)),
                ('instructions_en', models.TextField(blank=True, default='')),
                ('instructions_ja', models.TextField(blank=True, default='')),
                ('instructions_vi', models.TextField(blank=True, default='')),
                ('bank_name', models.CharField(blank=True, default='', max_length=120)),
                ('bank_bin', models.CharField(blank=True, default='', max_length=12)),
                ('account_name', models.CharField(blank=True, default='', max_length=150)),
                ('account_number', models.CharField(blank=True, default='', max_length=50)),
                ('currency', models.CharField(default='VND', max_length=3)),
                ('expiry_minutes', models.PositiveIntegerField(default=60)),
                ('sort_order', models.PositiveSmallIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering': ['sort_order', 'code']},
        ),
        migrations.CreateModel(
            name='PaymentTransaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('method', models.CharField(choices=[('cod', 'Cash on delivery'), ('bank_transfer', 'Bank transfer')], max_length=30)),
                ('provider', models.CharField(default='manual', max_length=30)),
                ('status', models.CharField(choices=[('pending', 'Pending payment'), ('proof_submitted', 'Proof submitted'), ('paid', 'Paid'), ('failed', 'Failed'), ('expired', 'Expired'), ('refunded', 'Refunded'), ('cod_pending', 'Collect on delivery'), ('cod_collected', 'COD collected')], db_index=True, max_length=20)),
                ('amount_usd', models.DecimalField(decimal_places=2, max_digits=12)),
                ('settlement_amount', models.DecimalField(decimal_places=0, max_digits=14)),
                ('settlement_currency', models.CharField(default='VND', max_length=3)),
                ('exchange_rate', models.DecimalField(decimal_places=4, max_digits=14)),
                ('reference', models.CharField(max_length=50, unique=True)),
                ('method_snapshot', models.JSONField(blank=True, default=dict)),
                ('receipt', models.ImageField(blank=True, null=True, upload_to='payment_receipts/')),
                ('proof_submitted_at', models.DateTimeField(blank=True, db_index=True, null=True)),
                ('paid_at', models.DateTimeField(blank=True, db_index=True, null=True)),
                ('verified_at', models.DateTimeField(blank=True, null=True)),
                ('expires_at', models.DateTimeField(blank=True, db_index=True, null=True)),
                ('failure_reason', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('order', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='payment', to='shop.order')),
                ('verified_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='verified_payments', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.RunPython(
            seed_payment_methods_and_normalize_orders,
            restore_legacy_order_methods,
        ),
    ]
