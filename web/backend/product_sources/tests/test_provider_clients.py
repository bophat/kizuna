import json
from decimal import Decimal

import httpx
from django.core.cache import cache
from django.test import SimpleTestCase

from product_sources.exceptions import (
    ProductNotFoundError,
    ProviderConfigurationError,
    ProviderRateLimitError,
)
from product_sources.providers.amazon_jp.adapter import AmazonJpProvider
from product_sources.providers.amazon_jp.client import AmazonCreatorsApiClient
from product_sources.providers.qoo10_jp.adapter import Qoo10JpProvider
from product_sources.providers.qoo10_jp.client import Qoo10ApiClient


class AmazonCreatorsApiProviderTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    @staticmethod
    def _client(handler) -> AmazonCreatorsApiClient:
        return AmazonCreatorsApiClient(
            credential_id='creator-id',
            credential_secret='creator-secret',
            credential_version='3.3',
            partner_tag='kizuna-22',
            http_client=httpx.Client(transport=httpx.MockTransport(handler)),
            sleeper=lambda _seconds: None,
        )

    def test_get_product_fetches_token_maps_item_and_caches_token(self):
        calls = {'token': 0, 'catalog': 0}

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.host == 'api.amazon.co.jp':
                calls['token'] += 1
                body = json.loads(request.content)
                self.assertEqual(body['scope'], 'creatorsapi::default')
                self.assertEqual(body['client_id'], 'creator-id')
                return httpx.Response(
                    200,
                    json={'access_token': 'access-token', 'expires_in': 3600},
                )

            calls['catalog'] += 1
            self.assertEqual(request.url.path, '/catalog/v1/getItems')
            self.assertEqual(request.headers['x-marketplace'], 'www.amazon.co.jp')
            self.assertEqual(request.headers['authorization'], 'Bearer access-token')
            body = json.loads(request.content)
            self.assertEqual(body['itemIds'], ['B09NQY6DY3'])
            self.assertEqual(body['partnerTag'], 'kizuna-22')
            return httpx.Response(
                200,
                json={
                    'itemsResult': {
                        'items': [
                            {
                                'asin': 'B09NQY6DY3',
                                'detailPageURL': (
                                    'https://www.amazon.co.jp/dp/B09NQY6DY3?tag=kizuna-22'
                                ),
                                'images': {
                                    'primary': {
                                        'large': {
                                            'url': 'https://m.media-amazon.com/images/I/main.jpg',
                                        },
                                    },
                                    'variants': [
                                        {
                                            'large': {
                                                'url': (
                                                    'https://m.media-amazon.com/images/I/variant.jpg'
                                                ),
                                            },
                                        },
                                    ],
                                },
                                'itemInfo': {
                                    'title': {'displayValue': 'Kem dưỡng Nhật'},
                                    'byLineInfo': {'brand': {'displayValue': 'KIZUNA Lab'}},
                                    'classifications': {
                                        'productGroup': {'displayValue': 'Beauty'},
                                    },
                                    'externalIds': {
                                        'eans': {'displayValues': ['4901234567890']},
                                    },
                                    'features': {
                                        'displayValues': ['Dưỡng ẩm', 'Không hương liệu'],
                                    },
                                    'productInfo': {
                                        'itemDimensions': {
                                            'weight': {
                                                'displayValue': 300,
                                                'unit': 'grams',
                                            },
                                        },
                                    },
                                },
                                'offersV2': {
                                    'listings': [
                                        {
                                            'isBuyBoxWinner': True,
                                            'availability': {'type': 'IN_STOCK'},
                                            'merchantInfo': {'name': 'Amazon.co.jp'},
                                            'price': {
                                                'money': {
                                                    'amount': 3980,
                                                    'currency': 'JPY',
                                                },
                                            },
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                },
            )

        provider = AmazonJpProvider(client=self._client(handler))
        first = provider.get_product(
            'B09NQY6DY3',
            canonical_url='https://www.amazon.co.jp/dp/B09NQY6DY3',
        )
        second = provider.get_product(
            'B09NQY6DY3',
            canonical_url='https://www.amazon.co.jp/dp/B09NQY6DY3',
        )

        self.assertEqual(calls, {'token': 1, 'catalog': 2})
        self.assertEqual(first.name, 'Kem dưỡng Nhật')
        self.assertEqual(first.brand, 'KIZUNA Lab')
        self.assertEqual(first.source_price, Decimal('3980'))
        self.assertEqual(first.weight_kg, Decimal('0.300'))
        self.assertEqual(first.availability, 'available')
        self.assertEqual(first.jan_code, '4901234567890')
        self.assertEqual(len(first.images), 2)
        self.assertEqual(second.source_product_id, first.source_product_id)
        self.assertNotIn('creator-secret', json.dumps(first.raw_data))
        self.assertNotIn('access-token', json.dumps(first.raw_data))

    def test_missing_creators_configuration_fails_closed(self):
        client = AmazonCreatorsApiClient(
            credential_id='',
            credential_secret='',
            credential_version='3.3',
            partner_tag='',
            http_client=httpx.Client(
                transport=httpx.MockTransport(
                    lambda _request: httpx.Response(500),
                ),
            ),
        )
        with self.assertRaises(ProviderConfigurationError) as raised:
            client.get_item('B09NQY6DY3')
        self.assertIn('AMAZON_CREATORS_CREDENTIAL_ID', raised.exception.message)

    def test_catalog_rate_limit_maps_to_domain_error(self):
        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.host == 'api.amazon.co.jp':
                return httpx.Response(
                    200,
                    json={'access_token': 'access-token', 'expires_in': 3600},
                )
            return httpx.Response(429, json={'errors': []})

        with self.assertRaises(ProviderRateLimitError):
            self._client(handler).get_item('B09NQY6DY3')


class Qoo10ApiProviderTests(SimpleTestCase):
    @staticmethod
    def _client(handler) -> Qoo10ApiClient:
        return Qoo10ApiClient(
            certification_key='qoo10-certification-key',
            http_client=httpx.Client(transport=httpx.MockTransport(handler)),
            sleeper=lambda _seconds: None,
        )

    def test_get_product_uses_header_auth_and_maps_qapi_response(self):
        def handler(request: httpx.Request) -> httpx.Response:
            self.assertEqual(
                request.url.path,
                '/GMKT.INC.Front.QAPIService/ItemsLookup.qapi/GetItemDetailInfo',
            )
            self.assertEqual(
                request.headers['giosiscertificationkey'],
                'qoo10-certification-key',
            )
            self.assertNotIn('qoo10-certification-key', str(request.url))
            body = json.loads(request.content)
            self.assertEqual(body['ItemCode'], '123456789')
            self.assertEqual(body['SellerCode'], '')
            return httpx.Response(
                200,
                json={
                    'ResultObject': [
                        {
                            'ItemCode': '123456789',
                            'ItemStatus': 'S2',
                            'ItemTitle': 'Mặt nạ dưỡng da',
                            'MainCatNm': 'Beauty',
                            'FirstSubCatNm': 'Skin Care',
                            'SecondSubCatNm': 'Masks',
                            'SellerCode': 'KIZUNA-001',
                            'IndustrialCodeType': 'J',
                            'IndustrialCode': '4909876543210',
                            'ItemPrice': '2,480',
                            'ItemQty': '12',
                            'BrandNm': 'KIZUNA',
                            'ItemDetail': '<p>Dưỡng ẩm dịu nhẹ</p>',
                            'ImageUrl': (
                                'http://gd.image-qoo10.jp/li/084/222/example.g_400-w_g.jpg'
                            ),
                        },
                    ],
                    'ResultCode': 0,
                    'ResultMsg': 'SUCCESS',
                },
            )

        provider = Qoo10JpProvider(client=self._client(handler))
        product = provider.get_product(
            '123456789',
            canonical_url='https://www.qoo10.jp/item/123456789',
        )
        self.assertEqual(product.name, 'Mặt nạ dưỡng da')
        self.assertEqual(product.brand, 'KIZUNA')
        self.assertEqual(product.source_category, 'Beauty > Skin Care > Masks')
        self.assertEqual(product.source_price, Decimal('2480'))
        self.assertEqual(product.stock_quantity, 12)
        self.assertEqual(product.availability, 'available')
        self.assertEqual(product.jan_code, '4909876543210')
        self.assertTrue(str(product.images[0].url).startswith('https://'))
        self.assertNotIn('qoo10-certification-key', json.dumps(product.raw_data))

    def test_qapi_not_found_maps_to_domain_error(self):
        client = self._client(
            lambda _request: httpx.Response(
                200,
                json={
                    'ResultObject': None,
                    'ResultCode': -10001,
                    'ResultMsg': 'not found',
                },
            ),
        )
        with self.assertRaises(ProductNotFoundError):
            client.get_item('123456789')

    def test_missing_qoo10_certification_key_fails_closed(self):
        client = Qoo10ApiClient(
            certification_key='',
            http_client=httpx.Client(
                transport=httpx.MockTransport(
                    lambda _request: httpx.Response(500),
                ),
            ),
        )
        with self.assertRaises(ProviderConfigurationError) as raised:
            client.get_item('123456789')
        self.assertIn('QOO10_CERTIFICATION_KEY', raised.exception.message)
