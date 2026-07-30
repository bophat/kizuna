from django.test import TestCase
from rest_framework.test import APIClient

from .models import Category, Product


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
