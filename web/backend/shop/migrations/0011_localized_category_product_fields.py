from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('shop', '0010_product_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='category',
            name='name_en',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='category',
            name='name_ja',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='category',
            name='name_vi',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='product',
            name='name_en',
            field=models.CharField(blank=True, default='', max_length=200),
        ),
        migrations.AddField(
            model_name='product',
            name='name_ja',
            field=models.CharField(blank=True, default='', max_length=200),
        ),
        migrations.AddField(
            model_name='product',
            name='name_vi',
            field=models.CharField(blank=True, default='', max_length=200),
        ),
        migrations.AddField(
            model_name='product',
            name='description_en',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='product',
            name='description_ja',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='product',
            name='description_vi',
            field=models.TextField(blank=True, default=''),
        ),
    ]
