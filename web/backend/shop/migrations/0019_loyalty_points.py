from decimal import Decimal, ROUND_FLOOR

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def award_points_for_delivered_orders(apps, schema_editor):
    Order = apps.get_model('shop', 'Order')
    UserProfile = apps.get_model('shop', 'UserProfile')
    LoyaltyPointTransaction = apps.get_model('shop', 'LoyaltyPointTransaction')

    for order in Order.objects.filter(status='delivered').iterator():
        eligible_amount = max(
            Decimal('0'),
            Decimal(order.subtotal_amount or 0) - Decimal(order.discount_amount or 0),
        )
        points = int(eligible_amount.to_integral_value(rounding=ROUND_FLOOR))
        profile, _ = UserProfile.objects.get_or_create(user_id=order.user_id)
        profile.points += points
        profile.save(update_fields=['points'])
        order.loyalty_points = points
        order.loyalty_points_active = True
        order.save(update_fields=['loyalty_points', 'loyalty_points_active'])
        if points:
            LoyaltyPointTransaction.objects.create(
                user_id=order.user_id,
                order_id=order.id,
                points_delta=points,
                balance_after=profile.points,
                reason='order_delivered',
            )


def remove_migrated_points(apps, schema_editor):
    Order = apps.get_model('shop', 'Order')
    UserProfile = apps.get_model('shop', 'UserProfile')

    for order in Order.objects.filter(loyalty_points_active=True).iterator():
        profile = UserProfile.objects.filter(user_id=order.user_id).first()
        if profile:
            profile.points = max(0, profile.points - order.loyalty_points)
            profile.save(update_fields=['points'])
        order.loyalty_points = 0
        order.loyalty_points_active = False
        order.save(update_fields=['loyalty_points', 'loyalty_points_active'])


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('shop', '0018_payment_methods_and_transactions'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='loyalty_points',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='order',
            name='loyalty_points_active',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.CreateModel(
            name='LoyaltyPointTransaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('points_delta', models.IntegerField()),
                ('balance_after', models.PositiveIntegerField()),
                ('reason', models.CharField(choices=[('order_delivered', 'Order delivered'), ('order_reversed', 'Order delivery reversed')], db_index=True, max_length=30)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='loyalty_point_transactions', to='shop.order')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='loyalty_point_transactions', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at', '-id']},
        ),
        migrations.RunPython(
            award_points_for_delivered_orders,
            remove_migrated_points,
        ),
    ]
