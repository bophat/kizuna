from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from product_sources.exceptions import ProviderConfigurationError, SSRFBlockedError
from product_sources.models import ProductSource
from product_sources.providers import AmazonJpProvider, build_provider_registry
from product_sources.security import redact_sensitive_data
from product_sources.services.compliance_service import validate_external_url
from product_sources.tests.utils import deterministic_public_dns


class SecurityTests(SimpleTestCase):
    def test_nested_sensitive_values_are_redacted(self):
        raw = {
            'name': 'safe',
            'nested': {
                'api_secret_key': 'secret-value',
                'items': [{'authorization': 'Bearer secret'}],
            },
        }
        redacted = redact_sensitive_data(raw)
        self.assertEqual(redacted['name'], 'safe')
        self.assertEqual(redacted['nested']['api_secret_key'], '[REDACTED]')
        self.assertEqual(redacted['nested']['items'][0]['authorization'], '[REDACTED]')

    def test_data_hash_does_not_depend_on_secret_value(self):
        first = ProductSource.compute_data_hash({'name': 'same', 'token': 'one'})
        second = ProductSource.compute_data_hash({'name': 'same', 'token': 'two'})
        self.assertEqual(first, second)

    @patch(
        'product_sources.services.compliance_service.socket.getaddrinfo',
        side_effect=deterministic_public_dns,
    )
    def test_private_ip_and_non_https_are_blocked(self, _resolver):
        with self.assertRaises(SSRFBlockedError):
            validate_external_url(
                'https://192.168.1.10/product',
                allowed_hosts=frozenset({'192.168.1.10'}),
            )
        with self.assertRaises(SSRFBlockedError):
            validate_external_url('http://www.amazon.co.jp/dp/B07HG6S41K')

    @patch(
        'product_sources.services.compliance_service.socket.getaddrinfo',
        side_effect=deterministic_public_dns,
    )
    def test_qoo10_image_cdn_is_allowed(self, _resolver):
        validate_external_url(
            'https://gd.image-qoo10.jp/li/084/222/example.g_400-w_g.jpg',
        )

    @override_settings(
        DEBUG=False,
        SOURCE_IMPORT_USE_FAKE_PROVIDERS=False,
        SOURCE_IMPORT_PUBLIC_PAGE_FALLBACK_ENABLED=False,
    )
    def test_production_registry_does_not_use_fake_provider(self):
        provider = build_provider_registry().get_by_code('amazon_jp')
        self.assertIsInstance(provider, AmazonJpProvider)
        with patch.dict('os.environ', {}, clear=True):
            with self.assertRaises(ProviderConfigurationError):
                provider.get_product('B07HG6S41K')
