from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0022_birthday_email_automation'),
    ]

    operations = [
        migrations.AddField(
            model_name='coupon',
            name='amount_currency',
            field=models.CharField(
                choices=[('USD', 'USD'), ('VND', 'VND')],
                default='USD',
                max_length=3,
            ),
        ),
        migrations.AddField(
            model_name='coupon',
            name='assigned_user',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='assigned_coupons',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='coupon',
            name='birthday_year',
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='coupon',
            name='source',
            field=models.CharField(
                choices=[('manual', 'Manual'), ('birthday', 'Birthday')],
                db_index=True,
                default='manual',
                max_length=12,
            ),
        ),
        migrations.AddConstraint(
            model_name='coupon',
            constraint=models.UniqueConstraint(
                condition=models.Q(source='birthday'),
                fields=('assigned_user', 'birthday_year'),
                name='unique_birthday_coupon_per_user_year',
            ),
        ),
    ]
