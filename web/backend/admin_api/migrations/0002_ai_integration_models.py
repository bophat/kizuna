# Generated manually for AI integration models

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('admin_api', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='PendingReply',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('channel', models.CharField(choices=[('messenger', 'Messenger'), ('comment', 'Comment'), ('website', 'Website')], default='messenger', max_length=20)),
                ('customer_id', models.CharField(max_length=255)),
                ('customer_name', models.CharField(blank=True, max_length=255)),
                ('incoming_message', models.TextField()),
                ('draft_reply', models.TextField()),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected'), ('sent', 'Sent')], default='pending', max_length=20)),
                ('is_greeting', models.BooleanField(default=False)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'pending_replies',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='TrendingProductLead',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('query', models.CharField(blank=True, max_length=500)),
                ('product_name', models.CharField(max_length=500)),
                ('platform', models.CharField(blank=True, max_length=50)),
                ('source_url', models.URLField(blank=True)),
                ('price_info', models.TextField(blank=True)),
                ('status', models.CharField(choices=[('new', 'New'), ('imported', 'Imported'), ('dismissed', 'Dismissed')], default='new', max_length=20)),
                ('raw_data', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'trending_product_leads',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='RepostLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source_post_id', models.CharField(max_length=255)),
                ('group_id', models.CharField(max_length=255)),
                ('message_preview', models.TextField(blank=True)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('success', 'Success'), ('failed', 'Failed')], default='pending', max_length=20)),
                ('error_message', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'repost_logs',
                'ordering': ['-created_at'],
            },
        ),
    ]
