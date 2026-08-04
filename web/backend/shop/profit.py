from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db.models import Q, QuerySet

from .models import PaymentTransaction


MONEY = Decimal('0.01')
PERCENT = Decimal('0.1')


def recognized_sales(queryset: QuerySet) -> QuerySet:
    """Orders whose payment is recognized for gross-profit reporting."""
    return queryset.filter(
        Q(
            payment__status__in=[
                PaymentTransaction.Status.PAID,
                PaymentTransaction.Status.COD_COLLECTED,
            ]
        )
        | Q(payment__isnull=True, status='delivered')
    )


def calculate_gross_profit_metrics(orders) -> dict[str, Decimal]:
    """
    Calculate estimated product gross profit for orders with known unit costs.

    Shipping revenue is intentionally excluded because actual last-mile shipping
    expense is not tracked yet. Order discounts are allocated proportionally to
    each order item. Legacy items may use the product's current cost when a cost
    snapshot is unavailable.
    """
    total_product_revenue = Decimal('0')
    covered_product_revenue = Decimal('0')
    cost_of_goods_sold = Decimal('0')
    default_rate = Decimal(str(getattr(settings, 'USD_VND_RATE', 25000)))

    for order in orders:
        subtotal = max(Decimal(order.subtotal_amount or 0), Decimal('0'))
        discount = max(Decimal(order.discount_amount or 0), Decimal('0'))
        net_product_revenue = max(subtotal - discount, Decimal('0'))
        if subtotal <= 0 or net_product_revenue <= 0:
            continue

        try:
            order_rate = Decimal(order.payment.exchange_rate or 0)
        except PaymentTransaction.DoesNotExist:
            order_rate = default_rate
        if order_rate <= 0:
            order_rate = default_rate

        for item in order.items.all():
            line_revenue = Decimal(item.price or 0) * item.quantity
            net_line_revenue = line_revenue * net_product_revenue / subtotal
            total_product_revenue += net_line_revenue

            unit_cost_vnd = item.unit_cost_vnd
            if unit_cost_vnd is None and item.product is not None:
                unit_cost_vnd = item.product.cost_price_vnd
            if unit_cost_vnd is None:
                continue

            covered_product_revenue += net_line_revenue
            cost_of_goods_sold += Decimal(unit_cost_vnd) * item.quantity / order_rate

    gross_profit = covered_product_revenue - cost_of_goods_sold
    profit_margin = (
        gross_profit * Decimal('100') / covered_product_revenue
        if covered_product_revenue > 0
        else Decimal('0')
    )
    cost_coverage = (
        covered_product_revenue * Decimal('100') / total_product_revenue
        if total_product_revenue > 0
        else Decimal('0')
    )

    return {
        'estimated_gross_profit': gross_profit.quantize(MONEY, rounding=ROUND_HALF_UP),
        'cost_of_goods_sold': cost_of_goods_sold.quantize(MONEY, rounding=ROUND_HALF_UP),
        'covered_product_revenue': covered_product_revenue.quantize(
            MONEY, rounding=ROUND_HALF_UP
        ),
        'profit_margin_percent': profit_margin.quantize(PERCENT, rounding=ROUND_HALF_UP),
        'profit_coverage_percent': cost_coverage.quantize(PERCENT, rounding=ROUND_HALF_UP),
    }
