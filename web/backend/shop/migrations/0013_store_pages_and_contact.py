from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


DEFAULT_PAGES = [
    ('privacy-policy', 'Chính sách bảo mật'),
    ('terms-of-service', 'Điều khoản dịch vụ'),
    ('shipping-returns', 'Giao hàng & trả hàng'),
    ('contact', 'Liên hệ'),
]


def seed_store_pages(apps, schema_editor):
    StorePage = apps.get_model('shop', 'StorePage')
    ContactInfo = apps.get_model('shop', 'ContactInfo')
    for slug, title in DEFAULT_PAGES:
        StorePage.objects.get_or_create(
            slug=slug,
            defaults={
                'title': title,
                'content': '## Nội dung đang được cập nhật\n\nVui lòng quay lại sau.',
                'content_type': 'markdown',
                'is_published': True,
            },
        )
    ContactInfo.objects.get_or_create(pk=1)


def remove_seeded_store_pages(apps, schema_editor):
    StorePage = apps.get_model('shop', 'StorePage')
    StorePage.objects.filter(slug__in=[slug for slug, _ in DEFAULT_PAGES]).delete()


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('shop', '0012_conciergesession_user'),
    ]

    operations = [
        migrations.CreateModel(
            name='ContactInfo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('phone', models.CharField(blank=True, default='', max_length=30)),
                ('email', models.EmailField(blank=True, default='', max_length=254)),
                ('address', models.TextField(blank=True, default='')),
                ('working_hours', models.CharField(blank=True, default='', max_length=255)),
                ('facebook_url', models.URLField(blank=True, default='', max_length=500)),
                ('zalo_url', models.URLField(blank=True, default='', max_length=500)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='ContactMessage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('email', models.EmailField(max_length=254)),
                ('message', models.TextField()),
                ('status', models.CharField(choices=[('unread', 'Unread'), ('read', 'Read'), ('replied', 'Replied')], db_index=True, default='unread', max_length=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='StorePage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.SlugField(max_length=50, unique=True)),
                ('title', models.CharField(max_length=255)),
                ('content', models.TextField(blank=True, default='')),
                ('content_type', models.CharField(choices=[('markdown', 'Markdown'), ('html', 'HTML')], default='markdown', max_length=10)),
                ('is_published', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_store_pages', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['id']},
        ),
        migrations.RunPython(seed_store_pages, remove_seeded_store_pages),
    ]
