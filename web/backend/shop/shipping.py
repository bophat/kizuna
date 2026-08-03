from decimal import Decimal, ROUND_HALF_UP

from .exchange_rates import get_exchange_rates


MONEY_STEP = Decimal('0.01')
LIGHT_ITEM_SHIPPING_VND = Decimal('50000')
HEAVY_KG_SHIPPING_VND = Decimal('180000')


def calculate_shipping_amount(items):
    """Return the checkout shipping amount in USD using the storefront formula."""
    shipping_vnd = Decimal('0')
    for item in items:
        product = item.product
        weight = Decimal(product.weight or '0.30')
        quantity = Decimal(item.quantity)
        if weight > Decimal('0.50'):
            rounded_weight = weight.to_integral_value(rounding='ROUND_CEILING')
            shipping_vnd += HEAVY_KG_SHIPPING_VND * rounded_weight * quantity
        else:
            shipping_vnd += LIGHT_ITEM_SHIPPING_VND * quantity

    rates = get_exchange_rates()
    usd_to_vnd = Decimal(str(rates.get('usd_to_vnd') or 25000))
    if usd_to_vnd <= 0:
        usd_to_vnd = Decimal('25000')
    return (shipping_vnd / usd_to_vnd).quantize(MONEY_STEP, rounding=ROUND_HALF_UP)
