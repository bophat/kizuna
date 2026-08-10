from decimal import Decimal, ROUND_HALF_UP

from .exchange_rates import get_exchange_rates


MONEY_STEP = Decimal('0.01')
LIGHT_ITEM_SHIPPING_VND = Decimal('50000')
HEAVY_KG_SHIPPING_VND = Decimal('180000')
BULK_DISCOUNT_THRESHOLD = 5
BULK_SHIPPING_DISCOUNT_VND = Decimal('100000')


def calculate_shipping_amount(items):
    """Return the checkout shipping amount in USD using the storefront formula."""
    shipping_vnd = Decimal('0')
    total_quantity = 0
    total_heavy_weight = Decimal('0')
    has_heavy_items = False

    for item in items:
        product = item.product
        weight = Decimal(product.weight or '0.30')
        quantity = Decimal(item.quantity)
        total_quantity += int(quantity)

        if weight > Decimal('0.50'):
            has_heavy_items = True
            total_heavy_weight += weight * quantity
        else:
            shipping_vnd += LIGHT_ITEM_SHIPPING_VND * quantity

    # Heavy items: calculate shipping based on total weight of entire order
    # Round up to nearest 0.5kg (n.0 or n.5), minimum 0.5kg
    if has_heavy_items:
        # Multiply by 2, ceiling, then divide by 2
        # e.g., 1.2 * 2 = 2.4 -> ceil = 3 -> 3/2 = 1.5
        # e.g., 1.0 * 2 = 2.0 -> ceil = 2 -> 2/2 = 1.0
        # e.g., 0.3 * 2 = 0.6 -> ceil = 1 -> 1/2 = 0.5 (but heavy items > 0.5 anyway)
        doubled = (total_heavy_weight * 2).to_integral_value(rounding='ROUND_CEILING')
        rounded_total_weight = Decimal(doubled) / Decimal('2')
        # Ensure minimum 0.5kg for heavy items
        if rounded_total_weight < Decimal('0.5'):
            rounded_total_weight = Decimal('0.5')
        shipping_vnd += HEAVY_KG_SHIPPING_VND * rounded_total_weight

    # Bulk discount: 100k VND off shipping when buying 5+ items
    if total_quantity >= BULK_DISCOUNT_THRESHOLD:
        shipping_vnd = max(shipping_vnd - BULK_SHIPPING_DISCOUNT_VND, Decimal('0'))

    rates = get_exchange_rates()
    usd_to_vnd = Decimal(str(rates.get('usd_to_vnd') or 25000))
    if usd_to_vnd <= 0:
        usd_to_vnd = Decimal('25000')
    return (shipping_vnd / usd_to_vnd).quantize(MONEY_STEP, rounding=ROUND_HALF_UP)
