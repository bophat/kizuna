from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0019_loyalty_points'),
    ]

    operations = [
        migrations.CreateModel(
            name='PaymentWebhookEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('provider', models.CharField(default='sepay', max_length=30)),
                ('event_id', models.CharField(max_length=100)),
                ('status', models.CharField(choices=[('processed', 'Processed'), ('ignored', 'Ignored')], max_length=20)),
                ('reason', models.CharField(blank=True, default='', max_length=200)),
                ('payload', models.JSONField(default=dict)),
                ('processed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('payment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='webhook_events', to='shop.paymenttransaction')),
            ],
            options={
                'ordering': ['-created_at'],
                'constraints': [models.UniqueConstraint(fields=('provider', 'event_id'), name='unique_payment_webhook_event')],
            },
        ),
    ]
