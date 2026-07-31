from decimal import Decimal

import httpx
from django.core.cache import cache
from django.test import SimpleTestCase, override_settings

from product_sources.enums import SourceProvider
from product_sources.exceptions import (
    ProviderConfigurationError,
    ProviderPermissionError,
)
from product_sources.providers.amazon_jp.adapter import AmazonJpProvider
from product_sources.providers.amazon_jp.client import AmazonCreatorsApiClient
from product_sources.providers.public_page_client import PublicPageProductClient
from product_sources.providers.qoo10_jp.adapter import Qoo10JpProvider
from product_sources.providers.qoo10_jp.client import Qoo10ApiClient


AMAZON_HTML = """
<!doctype html>
<html lang="ja">
  <head>
    <meta property="og:image"
          content="https://m.media-amazon.com/images/I/fallback.jpg">
    <meta name="description" content="Amazon public description">
  </head>
  <body>
    <span id="productTitle">ワフードメイド 酒粕パック 170g</span>
    <a id="bylineInfo">Wafood Madeのストアを表示</a>
    <span class="apex-pricetopay-accessibility-label">
      5パーセントの割引で￥1,254
    </span>
    <div id="availability"><span>在庫あり。</span></div>
    <img id="landingImage"
         data-old-hires="https://m.media-amazon.com/images/I/main.jpg"
         src="https://m.media-amazon.com/images/I/small.jpg">
    <div id="feature-bullets">
      <h1>この商品について</h1>
      <ul>
        <li><span>酒粕エキスを配合した洗い流しパック</span></li>
        <li><span>乾燥した肌にうるおいを与えます</span></li>
      </ul>
    </div>
  </body>
</html>
"""

QOO10_HTML = """
<!doctype html>
<html lang="ja">
  <head>
    <meta property="og:title" content="Qoo10 フェイスマスク 10枚">
    <meta property="og:image"
          content="https://gd.image-qoo10.jp/li/084/222/product.jpg">
    <meta name="description" content="毎日使える保湿マスク">
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "Qoo10 フェイスマスク 10枚",
        "brand": {"@type": "Brand", "name": "KIZUNA Lab"},
        "sku": "1153549061",
        "image": [
          "https://gd.image-qoo10.jp/li/084/222/product.jpg"
        ],
        "category": "Beauty > Skin Care",
        "description": "毎日使える保湿マスク",
        "offers": {
          "@type": "Offer",
          "priceCurrency": "JPY",
          "price": "2480",
          "availability": "https://schema.org/InStock",
          "seller": {"@type": "Organization", "name": "KIZUNA Store"}
        }
      }
    </script>
  </head>
  <body></body>
</html>
"""

BLOCKED_QOO10_HTML = """
<html>
  <body>
    <div class="section_error_full">connecting 130.62.104.134</div>
    <div>523 Error</div>
  </body>
</html>
"""


@override_settings(
    SOURCE_IMPORT_PUBLIC_PAGE_FALLBACK_ENABLED=True,
    SOURCE_IMPORT_PUBLIC_PAGE_CACHE_SECONDS=900,
)
class PublicPageProductClientTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    @staticmethod
    def _client(handler) -> PublicPageProductClient:
        return PublicPageProductClient(
            http_client=httpx.Client(transport=httpx.MockTransport(handler)),
            url_validator=lambda _url, **_kwargs: None,
        )

    def test_amazon_adapter_without_credentials_reads_public_page_and_caches(self):
        calls = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal calls
            calls += 1
            self.assertEqual(request.url.path, '/dp/B09NQY6DY3')
            return httpx.Response(
                200,
                headers={'Content-Type': 'text/html; charset=utf-8'},
                text=AMAZON_HTML,
            )

        page_client = self._client(handler)
        provider = AmazonJpProvider(
            client=AmazonCreatorsApiClient(
                credential_id='',
                credential_secret='',
                partner_tag='',
            ),
            public_page_client=page_client,
        )

        first = provider.get_product(
            'B09NQY6DY3',
            canonical_url='https://www.amazon.co.jp/dp/B09NQY6DY3',
        )
        second = provider.get_product(
            'B09NQY6DY3',
            canonical_url='https://www.amazon.co.jp/dp/B09NQY6DY3',
        )

        self.assertEqual(calls, 1)
        self.assertEqual(first.name, 'ワフードメイド 酒粕パック 170g')
        self.assertEqual(first.brand, 'Wafood Made')
        self.assertEqual(first.source_price, Decimal('1254'))
        self.assertEqual(first.availability, 'available')
        self.assertEqual(len(first.description_facts), 3)
        self.assertEqual(
            str(first.images[0].url),
            'https://m.media-amazon.com/images/I/main.jpg',
        )
        self.assertEqual(first.raw_data['source_method'], 'public_page')
        self.assertEqual(second.source_product_id, first.source_product_id)

    def test_qoo10_adapter_without_key_reads_json_ld(self):
        def handler(request: httpx.Request) -> httpx.Response:
            self.assertEqual(request.url.path, '/item/1153549061')
            return httpx.Response(
                200,
                headers={'Content-Type': 'text/html; charset=utf-8'},
                text=QOO10_HTML,
            )

        provider = Qoo10JpProvider(
            client=Qoo10ApiClient(certification_key=''),
            public_page_client=self._client(handler),
        )
        product = provider.get_product(
            '1153549061',
            canonical_url='https://www.qoo10.jp/item/1153549061',
        )

        self.assertEqual(product.name, 'Qoo10 フェイスマスク 10枚')
        self.assertEqual(product.brand, 'KIZUNA Lab')
        self.assertEqual(product.seller, 'KIZUNA Store')
        self.assertEqual(product.source_category, 'Beauty > Skin Care')
        self.assertEqual(product.source_price, Decimal('2480'))
        self.assertEqual(product.source_currency, 'JPY')
        self.assertEqual(product.availability, 'available')
        self.assertEqual(product.jan_code, '1153549061')
        self.assertEqual(len(product.images), 1)

    def test_qoo10_blocked_desktop_and_mobile_returns_clear_error(self):
        calls = 0

        def handler(_request: httpx.Request) -> httpx.Response:
            nonlocal calls
            calls += 1
            return httpx.Response(
                200,
                headers={'Content-Type': 'text/html'},
                text=BLOCKED_QOO10_HTML,
            )

        client = self._client(handler)
        with self.assertRaises(ProviderPermissionError) as raised:
            client.get_product(
                SourceProvider.QOO10_JP,
                '1153549061',
                canonical_url='https://www.qoo10.jp/item/1153549061',
            )

        self.assertEqual(calls, 2)
        self.assertIn('CAPTCHA', raised.exception.message)
        self.assertEqual(
            raised.exception.details['reason'],
            'public_page_blocked',
        )

    def test_partial_amazon_credentials_do_not_silently_fallback(self):
        class FailingPublicPageClient:
            def get_product(self, *_args, **_kwargs):
                raise AssertionError('Public fallback must not be used')

        provider = AmazonJpProvider(
            client=AmazonCreatorsApiClient(
                credential_id='configured-id',
                credential_secret='',
                partner_tag='',
            ),
            public_page_client=FailingPublicPageClient(),
        )

        with self.assertRaises(ProviderConfigurationError):
            provider.get_product(
                'B09NQY6DY3',
                canonical_url='https://www.amazon.co.jp/dp/B09NQY6DY3',
            )
