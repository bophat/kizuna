from django.test import TestCase
from rest_framework.test import APIRequestFactory

from admin_api.serializers import ProductSerializer
from product_sources.enums import SourceProvider
from product_sources.models import ProductSource
from shop.models import Category, Product, ProductStatus
from shop.serializers import PublicProductSerializer


class ProductImageSerializationTests(TestCase):
    def setUp(self):
        category = Category.objects.create(name='Beauty', slug='beauty-images')
        self.product = Product.objects.create(
            id='QOO-IMAGE-1',
            name='Qoo10 image product',
            price='10.00',
            currency='USD',
            category=category,
            description='Imported product',
            status=ProductStatus.PUBLISHED,
        )
        self.external_url = (
            'https://gd.image-qoo10.jp/li/084/222/example.g_400-w_g.jpg'
        )
        ProductSource.objects.create(
            product=self.product,
            provider=SourceProvider.QOO10_JP,
            source_product_id='IMAGE-1',
            source_url='https://www.qoo10.jp/item/IMAGE-1',
            canonical_url='https://www.qoo10.jp/item/IMAGE-1',
            external_image_url=self.external_url,
        )
        self.request = APIRequestFactory().get('/api/products/')

    def test_admin_product_uses_external_source_image_as_fallback(self):
        data = ProductSerializer(
            self.product,
            context={'request': self.request},
        ).data

        self.assertEqual(data['image'], self.external_url)

    def test_public_product_uses_external_source_image_as_fallback(self):
        data = PublicProductSerializer(
            self.product,
            context={'request': self.request},
        ).data

        self.assertEqual(data['image'], self.external_url)

    def test_product_image_takes_precedence_over_source_fallback(self):
        product_url = 'https://m.media-amazon.com/images/I/product-main.jpg'
        self.product.image = product_url
        self.product.save(update_fields=['image'])

        data = PublicProductSerializer(
            self.product,
            context={'request': self.request},
        ).data

        self.assertEqual(data['image'], product_url)
