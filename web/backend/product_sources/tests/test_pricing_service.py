from decimal import Decimal
from django.test import SimpleTestCase
from product_sources.services.pricing_service import ProductPricingService, PricingConfig


class ProductPricingServiceTests(SimpleTestCase):
    def setUp(self):
        self.pricing_service = ProductPricingService()
        self.config = PricingConfig(
            jpy_buffer=Decimal("1000"),
            jpy_to_vnd_rate=Decimal("200"),
            markup_rate=Decimal("0.15"),
            light_shipping_vnd=Decimal("20000"),
            heavy_shipping_per_kg_vnd=Decimal("180000"),
            heavy_weight_threshold_kg=Decimal("0.5"),
        )
        self.usd_vnd_rate = Decimal("25000")

    def test_light_weight_pricing(self):
        # weight = 0.3 kg <= 0.5 kg (light shipping)
        result = self.pricing_service.calculate(
            source_price_jpy=Decimal("3980"),
            weight_kg=Decimal("0.3"),
            usd_vnd_rate=self.usd_vnd_rate,
            config=self.config,
        )
        # import_cost_vnd = (3980 + 1000) * 200 = 996,000
        # shipping_vnd = 20,000
        # selling_price_vnd = 996,000 * 1.15 + 20,000 = 1,145,400 + 20,000 = 1,165,400
        # selling_price_usd = 1,165,400 / 25000 = 46.616 -> 46.62
        self.assertEqual(result.import_cost_vnd, Decimal("996000"))
        self.assertEqual(result.shipping_vnd, Decimal("20000"))
        self.assertEqual(result.selling_price_vnd, Decimal("1165400"))
        self.assertEqual(result.selling_price_usd, Decimal("46.62"))
        self.assertEqual(result.source_currency, "JPY")
        self.assertEqual(result.source_price_vnd, Decimal("796000"))

    def test_heavy_weight_pricing(self):
        # weight = 0.8 kg > 0.5 kg (heavy shipping)
        result = self.pricing_service.calculate(
            source_price_jpy=Decimal("3980"),
            weight_kg=Decimal("0.8"),
            usd_vnd_rate=self.usd_vnd_rate,
            config=self.config,
        )
        # import_cost_vnd = (3980 + 1000) * 200 = 996,000
        # shipping_vnd = 0.8 * 180,000 = 144,000
        # selling_price_vnd = 996,000 * 1.15 + 144,000 = 1,145,400 + 144,000 = 1,289,400
        # selling_price_usd = 1,289,400 / 25000 = 51.576 -> 51.58
        self.assertEqual(result.import_cost_vnd, Decimal("996000"))
        self.assertEqual(result.shipping_vnd, Decimal("144000"))
        self.assertEqual(result.selling_price_vnd, Decimal("1289400"))
        self.assertEqual(result.selling_price_usd, Decimal("51.58"))

    def test_threshold_weight_uses_light_shipping(self):
        result = self.pricing_service.calculate(
            source_price_jpy=Decimal('3980'),
            weight_kg=Decimal('0.5'),
            usd_vnd_rate=self.usd_vnd_rate,
            config=self.config,
        )
        self.assertEqual(result.shipping_vnd, Decimal('20000'))

    def test_usd_source_price_is_converted_to_vnd_before_pricing(self):
        result = self.pricing_service.calculate(
            source_price_jpy=Decimal('10'),
            source_currency='usd',
            weight_kg=Decimal('0.3'),
            usd_vnd_rate=self.usd_vnd_rate,
            config=self.config,
        )

        self.assertEqual(result.source_currency, 'USD')
        self.assertEqual(result.source_price_vnd, Decimal('250000'))
        self.assertEqual(result.import_cost_vnd, Decimal('450000'))
        self.assertEqual(result.selling_price_vnd, Decimal('537500'))
        self.assertEqual(result.selling_price_usd, Decimal('21.50'))

    def test_vnd_source_price_is_not_converted_twice(self):
        result = self.pricing_service.calculate(
            source_price_jpy=Decimal('300000'),
            source_currency='VND',
            weight_kg=Decimal('0.3'),
            usd_vnd_rate=self.usd_vnd_rate,
            config=self.config,
        )

        self.assertEqual(result.source_price_vnd, Decimal('300000'))
        self.assertEqual(result.import_cost_vnd, Decimal('500000'))
        self.assertEqual(result.selling_price_vnd, Decimal('595000'))
        self.assertEqual(result.selling_price_usd, Decimal('23.80'))

    def test_unsupported_source_currency_fails_instead_of_mispricing(self):
        with self.assertRaisesMessage(ValueError, 'Unsupported source currency: EUR'):
            self.pricing_service.calculate(
                source_price_jpy=Decimal('10'),
                source_currency='EUR',
                weight_kg=Decimal('0.3'),
                usd_vnd_rate=self.usd_vnd_rate,
                config=self.config,
            )

    def test_invalid_values(self):
        with self.assertRaises(ValueError):
            self.pricing_service.calculate(
                source_price_jpy=Decimal("-10"),
                weight_kg=Decimal("0.3"),
                usd_vnd_rate=self.usd_vnd_rate,
                config=self.config,
            )
        with self.assertRaises(ValueError):
            self.pricing_service.calculate(
                source_price_jpy=Decimal("3980"),
                weight_kg=Decimal("-0.1"),
                usd_vnd_rate=self.usd_vnd_rate,
                config=self.config,
            )
        with self.assertRaises(ValueError):
            self.pricing_service.calculate(
                source_price_jpy=Decimal("3980"),
                weight_kg=Decimal("0.3"),
                usd_vnd_rate=Decimal("0"),
                config=self.config,
            )
        with self.assertRaises(ValueError):
            self.pricing_service.calculate(
                source_price_jpy=Decimal("3980"),
                weight_kg=Decimal("0.3"),
                usd_vnd_rate=Decimal("-25000"),
                config=self.config,
            )
        
