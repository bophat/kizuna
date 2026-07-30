from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from product_sources.enums import ImageMode
from product_sources.models import SourceAuditLog, SourceImportJob
from product_sources.tests.utils import deterministic_public_dns
from shop.models import Category, Product

User = get_user_model()


@override_settings(SOURCE_IMPORT_USE_FAKE_PROVIDERS=True)
class ImportApiViewsTests(APITestCase):
    def setUp(self):
        dns_patcher = patch(
            'product_sources.services.compliance_service.socket.getaddrinfo',
            side_effect=deterministic_public_dns,
        )
        dns_patcher.start()
        self.addCleanup(dns_patcher.stop)
        self.category = Category.objects.create(name="Beauty", slug="beauty")
        self.admin_user = User.objects.create_superuser(username="admin", email="a@a.com", password="password")
        self.normal_user = User.objects.create_user(username="user", email="u@a.com", password="password")
        
        self.preview_url = reverse("admin-import-source-preview")
        self.import_url = reverse("admin-import-source")
        self.bulk_url = reverse("admin-import-source-bulk")

    def test_permission_denied_for_non_admin(self):
        # Anonymous
        response = self.client.post(self.preview_url, {})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED or status.HTTP_403_FORBIDDEN)

        # Non-admin authenticated user
        self.client.force_authenticate(user=self.normal_user)
        response = self.client.post(self.preview_url, {})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_preview_api_success(self):
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            "url": "https://www.amazon.co.jp/dp/B07HG6S41K",
            "category_id": self.category.id,
            "default_weight_kg": "0.30",
            "default_stock": 1,
            "image_mode": ImageMode.SKIP,
        }
        response = self.client.post(self.preview_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["provider"], "amazon_jp")
        self.assertEqual(response.data["source_product_id"], "B07HG6S41K")
        self.assertEqual(Product.objects.count(), 0)

    def test_import_api_success(self):
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            "url": "https://www.amazon.co.jp/dp/B07HG6S41K",
            "category_id": self.category.id,
            "default_weight_kg": "0.30",
            "default_stock": 2,
            "image_mode": ImageMode.REMOTE,
            "dry_run": False,
        }
        response = self.client.post(self.import_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["product_id"], "AMZ-B07HG6S41K")

        product = Product.objects.get(id="AMZ-B07HG6S41K")
        self.assertEqual(product.status, 'draft')

    def test_draft_product_is_hidden_from_public_catalog(self):
        self.client.force_authenticate(user=self.admin_user)
        self.client.post(
            self.import_url,
            {
                'url': 'https://www.amazon.co.jp/dp/B07HG6S41K',
                'category_id': self.category.id,
            },
            format='json',
        )

        self.client.force_authenticate(user=None)
        response = self.client.get('/api/shop/products/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

        self.client.force_authenticate(user=self.admin_user)
        publish_response = self.client.patch(
            '/api/admin/products/AMZ-B07HG6S41K/',
            {'status': 'published'},
            format='json',
        )
        self.assertEqual(publish_response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            SourceAuditLog.objects.filter(
                action='product.publish',
                product_id='AMZ-B07HG6S41K',
            ).exists(),
        )

        self.client.force_authenticate(user=None)
        published_response = self.client.get('/api/shop/products/')
        self.assertEqual(len(published_response.data), 1)

    def test_sync_and_bulk_sync_dry_run_api(self):
        self.client.force_authenticate(user=self.admin_user)
        self.client.post(
            self.import_url,
            {
                'url': 'https://www.amazon.co.jp/dp/B07HG6S41K',
                'category_id': self.category.id,
            },
            format='json',
        )

        sync_url = reverse(
            'admin-sync-source-product',
            kwargs={'product_id': 'AMZ-B07HG6S41K'},
        )
        response = self.client.post(sync_url, {'dry_run': True}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['dry_run'])

        bulk_response = self.client.post(
            reverse('admin-sync-sources'),
            {'dry_run': True},
            format='json',
        )
        self.assertEqual(bulk_response.status_code, status.HTTP_200_OK)
        self.assertEqual(bulk_response.data['succeeded'], 1)
        self.assertEqual(SourceImportJob.objects.count(), 0)

    def test_import_api_duplicate_conflict(self):
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            "url": "https://www.amazon.co.jp/dp/B07HG6S41K",
            "category_id": self.category.id,
            "default_weight_kg": "0.30",
            "default_stock": 2,
            "image_mode": ImageMode.REMOTE,
            "dry_run": False,
        }
        # First import
        self.client.post(self.import_url, payload, format="json")

        # Second import -> should fail with 409 Conflict
        response = self.client.post(self.import_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["error"]["code"], "DUPLICATE_SOURCE_PRODUCT")

    def test_bulk_import_api(self):
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            "urls": [
                "https://www.amazon.co.jp/dp/B07HG6S41K",
                "https://www.qoo10.jp/item/SOME-TITLE/123456789",
            ],
            "category_id": self.category.id,
            "default_weight_kg": "0.30",
            "default_stock": 1,
            "image_mode": ImageMode.SKIP,
            "dry_run": False,
        }
        response = self.client.post(self.bulk_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total"], 2)
        self.assertEqual(response.data["succeeded"], 2)
        self.assertEqual(response.data["failed"], 0)

    def test_csv_import_with_provider_url(self):
        self.client.force_authenticate(user=self.admin_user)
        csv_content = (
            "provider,source_product_id,url,sku,name,originalPrice,weight,category,category_id,brand,shipping,mainImage,All Images,stock\n"
            f",,https://www.amazon.co.jp/dp/B07HG6S41K,,Sample Product,3980,0.3,,{self.category.id},Sample Brand,,,,1\n"
        )
        import io
        csv_file = io.BytesIO(csv_content.encode("utf-8"))
        csv_file.name = "import.csv"

        csv_import_url = reverse("admin-import-csv")
        response = self.client.post(csv_import_url, {"csv_file": csv_file}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["created"], 1)
        self.assertEqual(response.data["skipped"], 0)
        self.assertEqual(len(response.data["errors"]), 0)

        product = Product.objects.get(id="AMZ-B07HG6S41K")
        self.assertEqual(product.status, 'draft')

    def test_csv_import_manual_fallback(self):
        self.client.force_authenticate(user=self.admin_user)
        csv_content = (
            "provider,source_product_id,url,sku,name,originalPrice,weight,category,category_id,brand,shipping,mainImage,All Images,stock\n"
            f",,,MANUAL123,Manual Name,¥3980,0.3,Beauty,{self.category.id},Manual Brand,,,,,1\n"
        )
        import io
        csv_file = io.BytesIO(csv_content.encode("utf-8"))
        csv_file.name = "import.csv"

        csv_import_url = reverse("admin-import-csv")
        response = self.client.post(csv_import_url, {"csv_file": csv_file}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["created"], 1)

        product = Product.objects.get(id="QOO-MANUAL123")
        self.assertEqual(product.status, 'draft')

    def test_csv_import_manual_no_auto_create_category(self):
        self.client.force_authenticate(user=self.admin_user)
        csv_content = (
            "provider,source_product_id,url,sku,name,originalPrice,weight,category,category_id,brand,shipping,mainImage,All Images,stock\n"
            ",,,MANUAL456,Manual Name,¥3980,0.3,NonExistentCategory,,Manual Brand,,,,,1\n"
        )
        import io
        csv_file = io.BytesIO(csv_content.encode("utf-8"))
        csv_file.name = "import.csv"

        # Explicitly disable auto category creation in settings mock or let it default to False
        with override_settings(ALLOW_AUTO_CREATE_CATEGORY=False):
            csv_import_url = reverse("admin-import-csv")
            response = self.client.post(csv_import_url, {"csv_file": csv_file}, format="multipart")
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data["created"], 0)
            self.assertEqual(len(response.data["errors"]), 1)
            self.assertIn("does not exist and auto-creation is disabled", response.data["errors"][0])
