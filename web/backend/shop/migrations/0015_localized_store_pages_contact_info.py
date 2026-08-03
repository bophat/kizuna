from django.db import migrations, models


PAGE_TITLES = {
    'privacy-policy': {
        'en': 'Privacy Policy',
        'ja': 'プライバシーポリシー',
        'vi': 'Chính sách bảo mật',
    },
    'terms-of-service': {
        'en': 'Terms of Service',
        'ja': '利用規約',
        'vi': 'Điều khoản dịch vụ',
    },
    'shipping-returns': {
        'en': 'Shipping & Returns',
        'ja': '配送・返品',
        'vi': 'Giao hàng & trả hàng',
    },
    'contact': {
        'en': 'Contact',
        'ja': 'お問い合わせ',
        'vi': 'Liên hệ',
    },
}

PLACEHOLDERS = {
    'en': '## Content is being updated\n\nPlease check back later.',
    'ja': '## コンテンツを更新中です\n\nしばらくしてからもう一度ご確認ください。',
    'vi': '## Nội dung đang được cập nhật\n\nVui lòng quay lại sau.',
}


def populate_localized_content(apps, schema_editor):
    StorePage = apps.get_model('shop', 'StorePage')
    ContactInfo = apps.get_model('shop', 'ContactInfo')

    for page in StorePage.objects.all():
        titles = PAGE_TITLES.get(page.slug, {})
        page.title_en = titles.get('en', '')
        page.title_ja = titles.get('ja', '')
        page.title_vi = titles.get('vi', page.title)
        page.content_vi = page.content
        if page.content.strip() == PLACEHOLDERS['vi']:
            page.content_en = PLACEHOLDERS['en']
            page.content_ja = PLACEHOLDERS['ja']
        page.save(update_fields=[
            'title_en', 'title_ja', 'title_vi',
            'content_en', 'content_ja', 'content_vi',
        ])

    for contact_info in ContactInfo.objects.all():
        contact_info.address_vi = contact_info.address
        contact_info.working_hours_vi = contact_info.working_hours
        contact_info.save(update_fields=['address_vi', 'working_hours_vi'])


class Migration(migrations.Migration):
    dependencies = [
        ('shop', '0014_contactinfo_instagram_url_tiktok_url'),
    ]

    operations = [
        migrations.AddField(model_name='storepage', name='title_en', field=models.CharField(blank=True, default='', max_length=255)),
        migrations.AddField(model_name='storepage', name='title_ja', field=models.CharField(blank=True, default='', max_length=255)),
        migrations.AddField(model_name='storepage', name='title_vi', field=models.CharField(blank=True, default='', max_length=255)),
        migrations.AddField(model_name='storepage', name='content_en', field=models.TextField(blank=True, default='')),
        migrations.AddField(model_name='storepage', name='content_ja', field=models.TextField(blank=True, default='')),
        migrations.AddField(model_name='storepage', name='content_vi', field=models.TextField(blank=True, default='')),
        migrations.AddField(model_name='contactinfo', name='address_en', field=models.TextField(blank=True, default='')),
        migrations.AddField(model_name='contactinfo', name='address_ja', field=models.TextField(blank=True, default='')),
        migrations.AddField(model_name='contactinfo', name='address_vi', field=models.TextField(blank=True, default='')),
        migrations.AddField(model_name='contactinfo', name='working_hours_en', field=models.CharField(blank=True, default='', max_length=255)),
        migrations.AddField(model_name='contactinfo', name='working_hours_ja', field=models.CharField(blank=True, default='', max_length=255)),
        migrations.AddField(model_name='contactinfo', name='working_hours_vi', field=models.CharField(blank=True, default='', max_length=255)),
        migrations.RunPython(populate_localized_content, migrations.RunPython.noop),
    ]
