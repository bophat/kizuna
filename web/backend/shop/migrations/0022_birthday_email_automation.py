from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0021_product_and_order_item_costs'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='birthday_email_enabled',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='date_of_birth',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='preferred_language',
            field=models.CharField(
                choices=[
                    ('en', 'English'),
                    ('ja', 'Japanese'),
                    ('vi', 'Vietnamese'),
                ],
                default='vi',
                max_length=2,
            ),
        ),
        migrations.CreateModel(
            name='BirthdayEmailDelivery',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('birthday_year', models.PositiveSmallIntegerField()),
                ('email', models.EmailField(max_length=254)),
                ('status', models.CharField(choices=[('sent', 'Sent'), ('failed', 'Failed')], max_length=10)),
                ('attempt_count', models.PositiveSmallIntegerField(default=0)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('error_message', models.CharField(blank=True, default='', max_length=500)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='birthday_email_deliveries', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-birthday_year', '-created_at'],
                'constraints': [models.UniqueConstraint(fields=('user', 'birthday_year'), name='unique_birthday_email_per_user_year')],
            },
        ),
    ]
