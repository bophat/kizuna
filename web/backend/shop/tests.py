from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from .concierge_store import sessions_for_admin
from .models import Category, ConciergeSession, ContactInfo, ContactMessage, Product, StorePage


class PublicCatalogLocalizationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(
            name='Original category',
            name_en='English category',
            name_ja='日本語カテゴリー',
            name_vi='Danh mục tiếng Việt',
            slug='localized-category',
        )
        Product.objects.create(
            id='I18N-001',
            name='Original product',
            name_en='English product',
            name_ja='日本語の商品',
            name_vi='Sản phẩm tiếng Việt',
            description='Original description',
            description_en='English description',
            description_ja='日本語の説明',
            description_vi='Mô tả tiếng Việt',
            category=self.category,
            price='10.00',
        )

    def test_product_and_category_follow_accept_language(self):
        expected = {
            'en': ('English product', 'English description', 'English category'),
            'ja': ('日本語の商品', '日本語の説明', '日本語カテゴリー'),
            'vi': ('Sản phẩm tiếng Việt', 'Mô tả tiếng Việt', 'Danh mục tiếng Việt'),
        }

        for language, values in expected.items():
            with self.subTest(language=language):
                response = self.client.get(
                    '/api/shop/products/I18N-001/',
                    HTTP_ACCEPT_LANGUAGE=language,
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    (response.data['name'], response.data['description'], response.data['category']),
                    values,
                )

    def test_missing_translation_falls_back_to_original_content(self):
        product = Product.objects.get(pk='I18N-001')
        product.name_vi = ''
        product.save(update_fields=['name_vi'])

        response = self.client.get(
            '/api/shop/products/I18N-001/',
            HTTP_ACCEPT_LANGUAGE='vi',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name'], 'Original product')

    def test_api_errors_follow_accept_language(self):
        response = self.client.get(
            '/api/shop/products/DOES-NOT-EXIST/',
            HTTP_ACCEPT_LANGUAGE='ja',
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data['detail'], '該当するデータが見つかりません。')

    def test_home_endpoint_returns_small_localized_sections(self):
        product = Product.objects.get(pk='I18N-001')
        product.is_new = True
        product.is_featured = True
        product.save(update_fields=['is_new', 'is_featured'])

        response = self.client.get(
            '/api/shop/products/home/',
            HTTP_ACCEPT_LANGUAGE='vi',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['new_arrivals'][0]['name'], 'Sản phẩm tiếng Việt')
        self.assertEqual(response.data['featured'][0]['name'], 'Sản phẩm tiếng Việt')
        self.assertLessEqual(len(response.data['new_arrivals']), 3)
        self.assertLessEqual(len(response.data['featured']), 4)

    def test_related_endpoint_excludes_current_product(self):
        Product.objects.create(
            id='I18N-002',
            name='Related product',
            description='Related description',
            category=self.category,
            price='12.00',
        )

        response = self.client.get('/api/shop/products/I18N-001/related/')

        self.assertEqual(response.status_code, 200)
        returned_ids = [item['id'] for item in response.data]
        self.assertIn('I18N-002', returned_ids)
        self.assertNotIn('I18N-001', returned_ids)

    @patch('shop.views.PUBLIC_API_CACHE_SECONDS', 60)
    def test_home_endpoint_uses_cache_after_first_request(self):
        cache.clear()
        first = self.client.get('/api/shop/products/home/')
        self.assertEqual(first.status_code, 200)

        with self.assertNumQueries(0):
            second = self.client.get('/api/shop/products/home/')

        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.data, first.data)
        cache.clear()


class ConciergeCustomerIdentityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='hanako',
            email='hanako@example.com',
            first_name='Hanako',
            last_name='Yamada',
            password='test-password-123',
        )

    @patch('shop.concierge_store.is_ai_enabled', return_value=False)
    def test_authenticated_message_exposes_profile_name_to_admin(self, _mock_ai):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            '/api/shop/concierge/message/',
            {'session_id': 'web_authenticated', 'message': 'hello'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        session = ConciergeSession.objects.get(session_id='web_authenticated')
        self.assertEqual(session.user, self.user)

        admin_session = sessions_for_admin()['web_authenticated']
        self.assertEqual(admin_session['customer_name'], 'Hanako Yamada')
        self.assertEqual(admin_session['customer_email'], 'hanako@example.com')
        self.assertEqual(admin_session['customer_username'], 'hanako')

    @patch('shop.concierge_store.is_ai_enabled', return_value=False)
    def test_customer_name_falls_back_to_username(self, _mock_ai):
        self.user.first_name = ''
        self.user.last_name = ''
        self.user.save(update_fields=['first_name', 'last_name'])
        self.client.force_authenticate(user=self.user)

        self.client.post(
            '/api/shop/concierge/message/',
            {'session_id': 'web_username', 'message': 'hello'},
            format='json',
        )

        admin_session = sessions_for_admin()['web_username']
        self.assertEqual(admin_session['customer_name'], 'hanako')


class PublicStoreContentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.page, _ = StorePage.objects.update_or_create(
            slug='privacy-policy',
            defaults={
                'title': 'Privacy policy',
                'content': '## Safe content',
                'title_en': 'Privacy Policy',
                'title_ja': 'プライバシーポリシー',
                'title_vi': 'Chính sách bảo mật',
                'content_en': '## Safe English content',
                'content_ja': '## 安全な日本語コンテンツ',
                'content_vi': '## Nội dung tiếng Việt an toàn',
                'content_type': StorePage.ContentType.MARKDOWN,
                'is_published': True,
            },
        )

    def test_published_page_is_public(self):
        response = self.client.get('/api/pages/privacy-policy/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['slug'], 'privacy-policy')
        self.assertEqual(response.data['title'], 'Privacy Policy')
        self.assertEqual(response.data['content'], '## Safe English content')
        self.assertNotIn('is_published', response.data)

    def test_page_content_follows_accept_language(self):
        expected = {
            'en': ('Privacy Policy', '## Safe English content'),
            'ja': ('プライバシーポリシー', '## 安全な日本語コンテンツ'),
            'vi': ('Chính sách bảo mật', '## Nội dung tiếng Việt an toàn'),
        }
        for language, values in expected.items():
            with self.subTest(language=language):
                response = self.client.get(
                    '/api/pages/privacy-policy/',
                    HTTP_ACCEPT_LANGUAGE=language,
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual((response.data['title'], response.data['content']), values)

    def test_unpublished_page_returns_404(self):
        self.page.is_published = False
        self.page.save(update_fields=['is_published'])
        response = self.client.get('/api/pages/privacy-policy/')
        self.assertEqual(response.status_code, 404)

    def test_contact_info_is_public(self):
        info = ContactInfo.objects.order_by('id').first() or ContactInfo.objects.create()
        info.phone = '+84 123 456 789'
        info.email = 'hello@example.com'
        info.instagram_url = 'https://www.instagram.com/kizuna'
        info.tiktok_url = 'https://www.tiktok.com/@kizuna'
        info.address_en = 'Tokyo, Japan'
        info.address_ja = '日本、東京'
        info.address_vi = 'Tokyo, Nhật Bản'
        info.working_hours_en = 'Monday - Friday'
        info.working_hours_ja = '月曜日〜金曜日'
        info.working_hours_vi = 'Thứ Hai - Thứ Sáu'
        info.save()
        response = self.client.get('/api/contact-info/', HTTP_ACCEPT_LANGUAGE='ja')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['phone'], '+84 123 456 789')
        self.assertEqual(response.data['email'], 'hello@example.com')
        self.assertEqual(response.data['instagram_url'], 'https://www.instagram.com/kizuna')
        self.assertEqual(response.data['tiktok_url'], 'https://www.tiktok.com/@kizuna')
        self.assertEqual(response.data['address'], '日本、東京')
        self.assertEqual(response.data['working_hours'], '月曜日〜金曜日')

    def test_contact_form_saves_message(self):
        response = self.client.post(
            '/api/contact/submit/',
            {'name': 'Hanako', 'email': 'hanako@example.com', 'message': 'Please contact me.'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        message = ContactMessage.objects.get()
        self.assertEqual(message.name, 'Hanako')
        self.assertEqual(message.status, ContactMessage.Status.UNREAD)

    def test_contact_form_rejects_empty_message(self):
        response = self.client.post(
            '/api/contact/submit/',
            {'name': 'Hanako', 'email': 'hanako@example.com', 'message': '   '},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(ContactMessage.objects.exists())
