from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('shop', '0013_store_pages_and_contact'),
    ]

    operations = [
        migrations.AddField(
            model_name='contactinfo',
            name='instagram_url',
            field=models.URLField(blank=True, default='', max_length=500),
        ),
        migrations.AddField(
            model_name='contactinfo',
            name='tiktok_url',
            field=models.URLField(blank=True, default='', max_length=500),
        ),
    ]
