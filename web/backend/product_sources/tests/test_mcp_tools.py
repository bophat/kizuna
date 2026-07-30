from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from product_sources.mcp.server import (
    preview_source_product,
    import_source_product,
    bulk_import_source_products,
    sync_source_product,
    calculate_product_price,
    find_source_products_needing_review,
    generate_import_csv,
)
from shop.models import Category
from product_sources.tests.utils import deterministic_public_dns

User = get_user_model()


@override_settings(SOURCE_IMPORT_USE_FAKE_PROVIDERS=True)
class McpToolsTests(TestCase):
    def setUp(self):
        dns_patcher = patch(
            'product_sources.services.compliance_service.socket.getaddrinfo',
            side_effect=deterministic_public_dns,
        )
        dns_patcher.start()
        self.addCleanup(dns_patcher.stop)
        self.category = Category.objects.create(name="Beauty", slug="beauty")
        User.objects.create_user(
            username='mcp_system_user',
            password='password',
            is_staff=True,
        )

    def test_preview_source_product_tool(self):
        res = preview_source_product(
            url="https://www.amazon.co.jp/dp/B07HG6S41K",
            category_id=self.category.id,
        )
        self.assertEqual(res["provider"], "amazon_jp")
        self.assertEqual(res["source_product_id"], "B07HG6S41K")

    def test_import_source_product_tool_requires_confirmation(self):
        res = import_source_product(
            url="https://www.amazon.co.jp/dp/B07HG6S41K",
            category_id=self.category.id,
            dry_run=False,
            confirmation=False,
        )
        self.assertFalse(res["success"])
        self.assertIn("confirmation=true", res["error"])

    def test_import_source_product_tool_success_with_confirmation(self):
        res = import_source_product(
            url="https://www.amazon.co.jp/dp/B07HG6S41K",
            category_id=self.category.id,
            dry_run=False,
            confirmation=True,
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["product_id"], "AMZ-B07HG6S41K")

    def test_calculate_product_price_tool(self):
        res = calculate_product_price(
            source_price_jpy="3980",
            weight_kg="0.30",
            usd_vnd_rate="25000",
        )
        self.assertEqual(res["selling_price_usd"], "46.62")

    def test_generate_import_csv_tool(self):
        res = generate_import_csv(
            urls=["https://www.amazon.co.jp/dp/B07HG6S41K"]
        )
        self.assertIn("https://www.amazon.co.jp/dp/B07HG6S41K", res)
        self.assertIn("provider,source_product_id,url", res)
