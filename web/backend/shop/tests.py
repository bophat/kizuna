from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .concierge_store import sessions_for_admin
from .models import Category, ConciergeSession, Product


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
