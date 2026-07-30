from django.test import SimpleTestCase
from product_sources.exceptions import InvalidSourceUrlError
from product_sources.providers.amazon_jp.url_parser import (
    extract_amazon_asin,
    canonicalize_amazon_url,
    supports_amazon_url,
)
from product_sources.providers.qoo10_jp.url_parser import (
    extract_qoo10_item_code,
    canonicalize_qoo10_url,
    supports_qoo10_url,
)


class AmazonUrlParserTests(SimpleTestCase):
    def test_valid_amazon_urls(self):
        urls = [
            ("https://www.amazon.co.jp/dp/B07HG6S41K", "B07HG6S41K"),
            ("https://www.amazon.co.jp/gp/product/B07HG6S41K", "B07HG6S41K"),
            ("https://www.amazon.co.jp/Some-Product-Title/dp/B07HG6S41K?tag=assoc-22", "B07HG6S41K"),
        ]
        for url, expected in urls:
            with self.subTest(url=url):
                self.assertEqual(extract_amazon_asin(url), expected)
                self.assertTrue(supports_amazon_url(url))
                self.assertEqual(canonicalize_amazon_url(url), f"https://www.amazon.co.jp/dp/{expected}")

    def test_invalid_amazon_urls(self):
        urls = [
            "https://www.amazon.com/dp/B07HG6S41K",
            "https://www.google.com",
            "ftp://www.amazon.co.jp/dp/B07HG6S41K",
        ]
        for url in urls:
            with self.subTest(url=url):
                self.assertFalse(supports_amazon_url(url))
                with self.assertRaises(InvalidSourceUrlError):
                    extract_amazon_asin(url)


class Qoo10UrlParserTests(SimpleTestCase):
    def test_valid_qoo10_urls(self):
        urls = [
            ("https://www.qoo10.jp/item/SOME-TITLE/123456789", "123456789"),
            ("https://www.qoo10.jp/g/123456789", "123456789"),
            ("https://www.qoo10.jp/item?goodscode=123456789", "123456789"),
            ("https://m.qoo10.jp/gmkt.inc/Goods/Goods.aspx?goodscode=123456789", "123456789"),
        ]
        for url, expected in urls:
            with self.subTest(url=url):
                self.assertEqual(extract_qoo10_item_code(url), expected)
                self.assertTrue(supports_qoo10_url(url))
                self.assertEqual(canonicalize_qoo10_url(url), f"https://www.qoo10.jp/item/{expected}")

    def test_invalid_qoo10_urls(self):
        urls = [
            "https://www.qoo10.com/item/123456789",
            "https://www.yahoo.co.jp",
        ]
        for url in urls:
            with self.subTest(url=url):
                self.assertFalse(supports_qoo10_url(url))
                with self.assertRaises(InvalidSourceUrlError):
                    extract_qoo10_item_code(url)
