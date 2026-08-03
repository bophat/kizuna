from decimal import Decimal

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('shop', '0016_coupon_and_order_totals'),
    ]

    operations = [
        migrations.CreateModel(
            name='AffiliateProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(db_index=True, max_length=40, unique=True)),
                ('status', models.CharField(choices=[('pending', 'Pending approval'), ('active', 'Active'), ('suspended', 'Suspended')], db_index=True, default='pending', max_length=12)),
                ('commission_rate', models.DecimalField(decimal_places=2, default=Decimal('5.00'), max_digits=5)),
                ('cookie_days', models.PositiveSmallIntegerField(default=30)),
                ('payout_details_encrypted', models.TextField(blank=True, default='')),
                ('internal_notes', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_affiliates', to=settings.AUTH_USER_MODEL)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='affiliate_profile', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.AddField(
            model_name='coupon',
            name='affiliate',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='coupons', to='shop.affiliateprofile'),
        ),
        migrations.AddField(
            model_name='order',
            name='affiliate',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='orders', to='shop.affiliateprofile'),
        ),
        migrations.AddField(
            model_name='order',
            name='affiliate_attribution_source',
            field=models.CharField(blank=True, default='', max_length=12),
        ),
        migrations.AddField(
            model_name='order',
            name='affiliate_code',
            field=models.CharField(blank=True, default='', max_length=40),
        ),
        migrations.AddField(
            model_name='order',
            name='affiliate_commission_rate',
            field=models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=5),
        ),
        migrations.CreateModel(
            name='AffiliatePayout',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('paid', 'Paid'), ('cancelled', 'Cancelled')], db_index=True, default='draft', max_length=12)),
                ('currency', models.CharField(default='USD', max_length=3)),
                ('total_amount', models.DecimalField(decimal_places=2, default=0.0, max_digits=12)),
                ('payout_details_encrypted', models.TextField(blank=True, default='')),
                ('transaction_reference', models.CharField(blank=True, default='', max_length=100)),
                ('notes', models.TextField(blank=True, default='')),
                ('paid_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('affiliate', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='payouts', to='shop.affiliateprofile')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_affiliate_payouts', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='AffiliateVisit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('session_id', models.CharField(max_length=64)),
                ('landing_path', models.CharField(blank=True, default='', max_length=500)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('affiliate', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='visits', to='shop.affiliateprofile')),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.AddConstraint(
            model_name='affiliatevisit',
            constraint=models.UniqueConstraint(fields=('affiliate', 'session_id'), name='unique_affiliate_visit_session'),
        ),
        migrations.CreateModel(
            name='AffiliateCommission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('available', 'Available'), ('paid', 'Paid'), ('reversed', 'Reversed')], db_index=True, default='pending', max_length=12)),
                ('base_amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('commission_rate', models.DecimalField(decimal_places=2, max_digits=5)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('available_at', models.DateTimeField(blank=True, db_index=True, null=True)),
                ('paid_at', models.DateTimeField(blank=True, null=True)),
                ('reversed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('affiliate', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='commissions', to='shop.affiliateprofile')),
                ('order', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='affiliate_commission', to='shop.order')),
                ('payout', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='commissions', to='shop.affiliatepayout')),
            ],
            options={'ordering': ['-created_at']},
        ),
    ]
