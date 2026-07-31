from io import BytesIO
from unittest.mock import patch

import httpx
from django.test import SimpleTestCase, override_settings
from PIL import Image

from product_sources.exceptions import ImageValidationError
from product_sources.services.image_download_service import ImageDownloadService
from product_sources.tests.utils import deterministic_public_dns


@override_settings(
    SOURCE_IMPORT_IMAGE_DOWNLOAD_ENABLED=True,
    SOURCE_IMPORT_IMAGE_MAX_BYTES=1024 * 1024,
    SOURCE_IMPORT_IMAGE_MAX_PIXELS=1_000_000,
    SOURCE_IMPORT_IMAGE_MAX_REDIRECTS=3,
)
class ImageDownloadServiceTests(SimpleTestCase):
    def setUp(self):
        dns_patcher = patch(
            'product_sources.services.compliance_service.socket.getaddrinfo',
            side_effect=deterministic_public_dns,
        )
        dns_patcher.start()
        self.addCleanup(dns_patcher.stop)

    @staticmethod
    def _image_bytes(*, image_format='PNG', size=(2, 2)) -> bytes:
        output = BytesIO()
        Image.new('RGB', size, color='red').save(output, format=image_format)
        return output.getvalue()

    def _service(self, handler) -> ImageDownloadService:
        client = httpx.Client(transport=httpx.MockTransport(handler))
        self.addCleanup(client.close)
        return ImageDownloadService(client=client)

    def test_download_accepts_valid_png_and_generates_safe_filename(self):
        content = self._image_bytes()
        service = self._service(
            lambda request: httpx.Response(
                200,
                headers={'Content-Type': 'image/png'},
                content=content,
                request=request,
            ),
        )

        result = service.download(
            'https://m.media-amazon.com/images/I/example.png',
            filename_stem='AMZ/B07 unsafe',
        )

        self.assertEqual(result.content, content)
        self.assertEqual(result.content_type, 'image/png')
        self.assertRegex(result.filename, r'^AMZ-B07-unsafe-[a-f0-9]{12}\.png$')

    def test_redirect_target_is_validated_against_ssrf_rules(self):
        service = self._service(
            lambda request: httpx.Response(
                302,
                headers={'Location': 'http://169.254.169.254/latest/meta-data/'},
                request=request,
            ),
        )

        with self.assertRaises(ImageValidationError):
            service.download(
                'https://m.media-amazon.com/images/I/example.jpg',
                filename_stem='AMZ-B07',
            )

    def test_rejects_content_type_that_does_not_match_magic_bytes(self):
        content = self._image_bytes(image_format='PNG')
        service = self._service(
            lambda request: httpx.Response(
                200,
                headers={'Content-Type': 'image/jpeg'},
                content=content,
                request=request,
            ),
        )

        with self.assertRaises(ImageValidationError):
            service.download(
                'https://gd.image-gmkt.com/example.jpg',
                filename_stem='Q10-123',
            )

    @override_settings(SOURCE_IMPORT_IMAGE_MAX_BYTES=16)
    def test_rejects_image_over_byte_limit(self):
        content = self._image_bytes()
        service = self._service(
            lambda request: httpx.Response(
                200,
                headers={'Content-Type': 'image/png'},
                content=content,
                request=request,
            ),
        )

        with self.assertRaises(ImageValidationError):
            service.download(
                'https://gd.image-gmkt.com/example.png',
                filename_stem='Q10-123',
            )

    @override_settings(SOURCE_IMPORT_IMAGE_MAX_PIXELS=3)
    def test_rejects_image_over_pixel_limit(self):
        content = self._image_bytes(size=(2, 2))
        service = self._service(
            lambda request: httpx.Response(
                200,
                headers={'Content-Type': 'image/png'},
                content=content,
                request=request,
            ),
        )

        with self.assertRaises(ImageValidationError):
            service.download(
                'https://gd.image-gmkt.com/example.png',
                filename_stem='Q10-123',
            )

    @override_settings(SOURCE_IMPORT_IMAGE_DOWNLOAD_ENABLED=False)
    def test_download_is_fail_closed_until_policy_is_enabled(self):
        service = ImageDownloadService()

        with self.assertRaises(ImageValidationError):
            service.download(
                'https://m.media-amazon.com/images/I/example.jpg',
                filename_stem='AMZ-B07',
            )
