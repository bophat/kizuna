from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings


@dataclass(frozen=True)
class PricingConfig:
    jpy_buffer: Decimal = Decimal('1000')
    jpy_to_vnd_rate: Decimal = Decimal('200')
    markup_rate: Decimal = Decimal('0.15')
    light_shipping_vnd: Decimal = Decimal('20000')
    heavy_shipping_per_kg_vnd: Decimal = Decimal('180000')
    heavy_weight_threshold_kg: Decimal = Decimal('0.5')


@dataclass(frozen=True)
class PricingResult:
    source_price_jpy: Decimal
    import_cost_vnd: Decimal
    shipping_vnd: Decimal
    selling_price_vnd: Decimal
    selling_price_usd: Decimal
    calculation_snapshot: dict


def get_pricing_config() -> PricingConfig:
    return PricingConfig(
        jpy_buffer=Decimal(str(getattr(settings, 'SOURCE_IMPORT_JPY_BUFFER', '1000'))),
        jpy_to_vnd_rate=Decimal(str(getattr(settings, 'SOURCE_IMPORT_JPY_TO_VND_RATE', '200'))),
        markup_rate=Decimal(str(getattr(settings, 'SOURCE_IMPORT_MARKUP_RATE', '0.15'))),
        light_shipping_vnd=Decimal(str(getattr(settings, 'SOURCE_IMPORT_LIGHT_SHIPPING_VND', '20000'))),
        heavy_shipping_per_kg_vnd=Decimal(
            str(getattr(settings, 'SOURCE_IMPORT_HEAVY_SHIPPING_PER_KG_VND', '180000')),
        ),
        heavy_weight_threshold_kg=Decimal(
            str(getattr(settings, 'SOURCE_IMPORT_HEAVY_WEIGHT_THRESHOLD_KG', '0.5')),
        ),
    )


class ProductPricingService:
    def calculate(
        self,
        *,
        source_price_jpy: Decimal,
        weight_kg: Decimal,
        usd_vnd_rate: Decimal,
        config: PricingConfig | None = None,
    ) -> PricingResult:
        config = config or get_pricing_config()

        if source_price_jpy < 0:
            raise ValueError('source_price_jpy must be >= 0')
        if weight_kg < 0:
            raise ValueError('weight_kg must be >= 0')
        if usd_vnd_rate <= 0:
            raise ValueError('usd_vnd_rate must be > 0')

        import_cost_vnd = (source_price_jpy + config.jpy_buffer) * config.jpy_to_vnd_rate

        if weight_kg > config.heavy_weight_threshold_kg:
            shipping_vnd = weight_kg * config.heavy_shipping_per_kg_vnd
        else:
            shipping_vnd = config.light_shipping_vnd

        selling_price_vnd = import_cost_vnd * (Decimal('1') + config.markup_rate) + shipping_vnd
        selling_price_usd = (selling_price_vnd / usd_vnd_rate).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP,
        )

        return PricingResult(
            source_price_jpy=source_price_jpy,
            import_cost_vnd=import_cost_vnd,
            shipping_vnd=shipping_vnd,
            selling_price_vnd=selling_price_vnd,
            selling_price_usd=selling_price_usd,
            calculation_snapshot={
                'jpy_buffer': str(config.jpy_buffer),
                'jpy_to_vnd_rate': str(config.jpy_to_vnd_rate),
                'markup_rate': str(config.markup_rate),
                'light_shipping_vnd': str(config.light_shipping_vnd),
                'heavy_shipping_per_kg_vnd': str(config.heavy_shipping_per_kg_vnd),
                'heavy_weight_threshold_kg': str(config.heavy_weight_threshold_kg),
                'usd_vnd_rate': str(usd_vnd_rate),
            },
        )
