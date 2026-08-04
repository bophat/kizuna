import tempfile
from decimal import Decimal
from pathlib import Path
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from product_sources.enums import ImageMode, SourceSyncStatus
from product_sources.exceptions import (
    DuplicateSourceProductError,
    ImageValidationError,
    SSRFBlockedError,
)
from product_sources.models import (
    ProductSource,
    ProductPriceHistory,
    SourceAuditLog,
    SourceCategoryMapping,
    SourceImportJob,
)
from product_sources.schemas.import_request import BulkImportRequest, ImportSourceProductRequest, PreviewImportRequest
from product_sources.services.image_download_service import DownloadedImage
from product_sources.services.import_service import SourceImportService
from product_sources.tests.utils import deterministic_public_dns
from shop.models import Category, Product, ProductStatus

User = get_user_model()


@override_settings(SOURCE_IMPORT_USE_FAKE_PROVIDERS=True)
class SourceImportServiceTests(TestCase):
    def setUp(self):
        dns_patcher = patch(
            'product_sources.services.compliance_service.socket.getaddrinfo',
            side_effect=deterministic_public_dns,
        )
        dns_patcher.start()
        self.addCleanup(dns_patcher.stop)
        self.service = SourceImportService()
        self.category = Category.objects.create(name="Beauty", slug="beauty")
        self.user = User.objects.create_user(username="admin", password="password", is_staff=True)

    def test_preview_success(self):
        req = PreviewImportRequest(
            url="https://www.amazon.co.jp/dp/B07HG6S41K",
            category_id=self.category.id,
            default_weight_kg=Decimal("0.3"),
            default_stock=5,
        )
        preview = self.service.preview(req)
        self.assertEqual(preview.provider, "amazon_jp")
        self.assertEqual(preview.source_product_id, "B07HG6S41K")
        self.assertEqual(preview.product_payload.id, "AMZ-B07HG6S41K")
        self.assertEqual(preview.product_payload.price, "46.62") # (3980+1000)*200 * 1.15 + 20000 = 1165400 / 25000 = 46.62
        self.assertIn('Sample fact 1', preview.product_payload.description)
        self.assertFalse(preview.duplicate)
        self.assertFalse(preview.category_required)

    def test_preview_ssrf_blocked(self):
        req = PreviewImportRequest(
            url="https://192.168.1.1/dp/B07HG6S41K",
            category_id=self.category.id,
        )
        with self.assertRaises(SSRFBlockedError):
            self.service.preview(req)

    def test_import_success(self):
        provider = self.service.provider_registry.get_by_code('amazon_jp')
        provider.get_product = Mock(wraps=provider.get_product)
        req = ImportSourceProductRequest(
            url="https://www.amazon.co.jp/dp/B07HG6S41K",
            category_id=self.category.id,
            default_weight_kg=Decimal("0.3"),
            default_stock=5,
            image_mode=ImageMode.REMOTE,
            dry_run=False,
        )
        res = self.service.import_product(req, self.user)
        provider.get_product.assert_called_once()
        self.assertTrue(res.success)
        self.assertEqual(res.product_id, "AMZ-B07HG6S41K")
        self.assertIsNotNone(res.source_id)

        # Check DB
        product = Product.objects.get(id="AMZ-B07HG6S41K")
        self.assertEqual(product.name, "[Fake Amazon] Sample Product B07HG6S41K")
        self.assertEqual(product.price, Decimal("46.62"))
        self.assertEqual(product.cost_price_vnd, Decimal("1016000"))
        self.assertFalse(product.image)

        source = ProductSource.objects.get(id=res.source_id)
        self.assertEqual(source.provider, "amazon_jp")
        self.assertEqual(source.source_product_id, "B07HG6S41K")
        self.assertEqual(source.sync_status, SourceSyncStatus.SUCCESS)
        self.assertEqual(
            source.external_image_url,
            'https://m.media-amazon.com/images/I/sample.jpg',
        )

        # Check Price History
        history = ProductPriceHistory.objects.filter(product=product)
        self.assertEqual(history.count(), 1)
        self.assertEqual(history.first().source_price_jpy, Decimal("3980"))
        self.assertEqual(SourceAuditLog.objects.filter(action='product_source.import').count(), 1)

    def test_import_download_mode_is_rejected_without_writes(self):
        req = ImportSourceProductRequest(
            url='https://www.amazon.co.jp/dp/B07HG6S41K',
            category_id=self.category.id,
            image_mode=ImageMode.DOWNLOAD,
        )
        with self.assertRaises(ImageValidationError):
            self.service.import_product(req, self.user)
        self.assertEqual(Product.objects.count(), 0)
        self.assertEqual(ProductSource.objects.count(), 0)

    def test_import_download_mode_saves_local_image_and_source_url(self):
        image_download_service = Mock()
        image_download_service.download.return_value = DownloadedImage(
            content=b'validated-image-content',
            filename='AMZ-B07HG6S41K-deadbeef1234.jpg',
            content_type='image/jpeg',
        )
        service = SourceImportService(image_download_service=image_download_service)
        req = ImportSourceProductRequest(
            url='https://www.amazon.co.jp/dp/B07HG6S41K',
            category_id=self.category.id,
            image_mode=ImageMode.DOWNLOAD,
        )

        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                result = service.import_product(req, self.user)
                product = Product.objects.get(pk=result.product_id)
                self.assertTrue(product.image.name.startswith('products/'))
                self.assertTrue(product.image.storage.exists(product.image.name))

        image_download_service.download.assert_called_once_with(
            'https://m.media-amazon.com/images/I/sample.jpg',
            filename_stem='AMZ-B07HG6S41K',
        )
        source = ProductSource.objects.get(pk=result.source_id)
        self.assertEqual(
            source.external_image_url,
            'https://m.media-amazon.com/images/I/sample.jpg',
        )

    def test_downloaded_image_is_deleted_when_database_import_rolls_back(self):
        image_download_service = Mock()
        image_download_service.download.return_value = DownloadedImage(
            content=b'validated-image-content',
            filename='AMZ-B07HG6S41K-deadbeef1234.jpg',
            content_type='image/jpeg',
        )
        service = SourceImportService(image_download_service=image_download_service)
        req = ImportSourceProductRequest(
            url='https://www.amazon.co.jp/dp/B07HG6S41K',
            category_id=self.category.id,
            image_mode=ImageMode.DOWNLOAD,
        )

        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                with patch.object(
                    ProductSource.objects,
                    'create',
                    side_effect=RuntimeError('DB fail'),
                ):
                    with self.assertRaises(RuntimeError):
                        service.import_product(req, self.user)
                self.assertEqual(list(Product.objects.values_list('id', flat=True)), [])
                self.assertEqual(
                    [path for path in Path(media_root).rglob('*') if path.is_file()],
                    [],
                )

    def test_bulk_dry_run_does_not_write_database(self):
        req = BulkImportRequest(
            urls=['https://www.amazon.co.jp/dp/B07HG6S41K'],
            category_id=self.category.id,
            dry_run=True,
        )
        result = self.service.bulk_import(req, self.user)
        self.assertEqual(result.succeeded, 1)
        self.assertIsNone(result.job_id)
        self.assertEqual(Product.objects.count(), 0)
        self.assertEqual(SourceImportJob.objects.count(), 0)
        self.assertEqual(SourceAuditLog.objects.count(), 0)

    def test_import_duplicate_error(self):
        req = ImportSourceProductRequest(
            url="https://www.amazon.co.jp/dp/B07HG6S41K",
            category_id=self.category.id,
            default_weight_kg=Decimal("0.3"),
            default_stock=5,
            image_mode=ImageMode.REMOTE,
            dry_run=False,
        )
        self.service.import_product(req, self.user)

        # Try importing again
        with self.assertRaises(DuplicateSourceProductError):
            self.service.import_product(req, self.user)

    def test_import_without_category_creates_uncategorized_draft(self):
        req = ImportSourceProductRequest(
            url='https://www.amazon.co.jp/dp/B07HG6S41K',
            category_id=None,
        )
        result = self.service.import_product(req, self.user)

        product = Product.objects.get(pk=result.product_id)
        self.assertIsNone(product.category)
        self.assertEqual(product.status, ProductStatus.DRAFT)

    def test_preview_uses_saved_category_mapping(self):
        SourceCategoryMapping.objects.create(
            provider='amazon_jp',
            source_category='Beauty > Skincare',
            target_category=self.category,
        )
        preview = self.service.preview(
            PreviewImportRequest(
                url='https://www.amazon.co.jp/dp/B07HG6S41K',
                category_id=None,
            ),
        )
        self.assertFalse(preview.category_required)
        self.assertEqual(preview.product_payload.category, self.category.id)

    def test_import_rolls_back_when_source_creation_fails(self):
        req = ImportSourceProductRequest(
            url='https://www.amazon.co.jp/dp/B07HG6S41K',
            category_id=self.category.id,
        )
        with patch.object(ProductSource.objects, 'create', side_effect=RuntimeError('DB fail')):
            with self.assertRaises(RuntimeError):
                self.service.import_product(req, self.user)
        self.assertEqual(Product.objects.count(), 0)
        self.assertEqual(SourceAuditLog.objects.count(), 0)

    def test_bulk_import(self):
        req = BulkImportRequest(
            urls=[
                "https://www.amazon.co.jp/dp/B07HG6S41K",
                "https://www.qoo10.jp/item/SOME-TITLE/123456789",
                "https://www.amazon.co.jp/dp/NOTFOUND000", # Will fail
            ],
            category_id=self.category.id,
            default_weight_kg=Decimal("0.3"),
            dry_run=False,
        )
        res = self.service.bulk_import(req, self.user)
        self.assertEqual(res.total, 3)
        self.assertEqual(res.succeeded, 2)
        self.assertEqual(res.failed, 1)

        # Verify Job in DB
        job = SourceImportJob.objects.get(id=res.job_id)
        self.assertEqual(job.total, 3)
        self.assertEqual(job.succeeded, 2)
        self.assertEqual(job.failed, 1)
