from decimal import Decimal
from unittest.mock import Mock
from django.test import TestCase, override_settings
from django.utils import timezone

from product_sources.enums import SourceAvailability, SourceSyncStatus
from product_sources.models import ProductSource, ProductPriceHistory, SourceAuditLog, SourceImportJob
from product_sources.services.sync_service import SyncService
from shop.models import Category, Product, ProductStatus


@override_settings(SOURCE_IMPORT_USE_FAKE_PROVIDERS=True)
class SyncServiceTests(TestCase):
    def setUp(self):
        self.service = SyncService()
        self.category = Category.objects.create(name="Beauty", slug="beauty")
        
        # Create a product and product source
        self.product = Product.objects.create(
            id="AMZ-B07HG6S41K",
            name="Sample Product",
            price=Decimal("46.62"),
            currency="USD",
            category=self.category,
            status=ProductStatus.PUBLISHED,
            stock=10,
            weight=Decimal("0.3"),
        )
        self.source = ProductSource.objects.create(
            product=self.product,
            provider="amazon_jp",
            source_product_id="B07HG6S41K",
            source_url="https://www.amazon.co.jp/dp/B07HG6S41K",
            canonical_url="https://www.amazon.co.jp/dp/B07HG6S41K",
            source_price_jpy=Decimal("3980"),
            source_availability=SourceAvailability.AVAILABLE,
            source_stock_quantity=10,
            sync_status=SourceSyncStatus.SUCCESS,
            last_synced_at=timezone.now(),
        )

    def test_sync_dry_run_no_changes(self):
        # Fake provider returns same price 3980 JPY
        res = self.service.sync_product(
            product_id=self.product.id,
            update_product_price=True,
            update_stock=True,
            dry_run=True,
        )
        self.assertTrue(res["success"])
        self.assertTrue(res["dry_run"])
        self.assertEqual(len(res["updates"]), 0)

    def test_sync_dry_run_price_increase(self):
        # Change old price to 2000 JPY to simulate price increase to 3980 JPY (+99%)
        self.source.source_price_jpy = Decimal("2000")
        self.source.save()

        res = self.service.sync_product(
            product_id=self.product.id,
            update_product_price=True,
            update_stock=True,
            dry_run=True,
        )
        self.assertTrue(res["success"])
        self.assertTrue(res["dry_run"])
        self.assertIn("status", res["updates"])
        self.assertEqual(res["updates"]["status"], ProductStatus.SUSPENDED) # because change is >= 15%

    def test_sync_execution_success(self):
        self.source.source_price_jpy = Decimal("2000")
        self.source.save()

        res = self.service.sync_product(
            product_id=self.product.id,
            update_product_price=True,
            update_stock=True,
            dry_run=False,
        )
        self.assertTrue(res["success"])
        self.assertFalse(res["dry_run"])

        # Check DB
        product = Product.objects.get(id=self.product.id)
        self.assertEqual(product.status, ProductStatus.SUSPENDED)
        history = ProductPriceHistory.objects.get(product=product)
        self.assertEqual(history.previous_product_price_usd, Decimal('46.62'))
        self.assertEqual(history.calculation_snapshot['usd_vnd_rate'], '25000')
        self.assertEqual(SourceAuditLog.objects.filter(action='product_source.sync').count(), 1)

    def test_unknown_availability_does_not_change_stock(self):
        provider = self.service.provider_registry.get_by_code('amazon_jp')
        provider_product = provider.get_product(
            self.source.source_product_id,
            canonical_url=self.source.canonical_url,
        )
        provider.get_product = Mock(
            return_value=provider_product.model_copy(
                update={'availability': 'unknown', 'stock_quantity': None},
            ),
        )

        result = self.service.sync_product(
            product_id=self.product.id,
            update_stock=True,
            dry_run=False,
        )
        self.assertTrue(result['success'])
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 10)

    def test_bulk_sync_dry_run_does_not_create_job_or_audit(self):
        result = self.service.bulk_sync(dry_run=True)
        self.assertEqual(result['succeeded'], 1)
        self.assertIsNone(result['job_id'])
        self.assertEqual(SourceImportJob.objects.count(), 0)
        self.assertEqual(SourceAuditLog.objects.count(), 0)
