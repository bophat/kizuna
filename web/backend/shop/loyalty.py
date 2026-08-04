from decimal import Decimal, ROUND_FLOOR

from django.db import transaction

from .models import LoyaltyPointTransaction, Order, UserProfile


def calculate_order_loyalty_points(order):
    """Award one point per 25,000 VND of products, excluding shipping.

    Order monetary fields remain canonical USD for backward compatibility, so
    one internal USD is equivalent to 25,000 VND under the loyalty policy.
    """
    eligible_amount = max(
        Decimal('0'),
        Decimal(order.subtotal_amount or 0) - Decimal(order.discount_amount or 0),
    )
    return int(eligible_amount.to_integral_value(rounding=ROUND_FLOOR))


@transaction.atomic
def sync_order_loyalty_points(order):
    """Keep the customer's balance aligned with the order delivery state."""
    locked_order = (
        Order.objects.select_for_update()
        .select_related('user')
        .get(pk=order.pk)
    )
    profile, _ = UserProfile.objects.select_for_update().get_or_create(
        user=locked_order.user
    )

    if locked_order.status == 'delivered' and not locked_order.loyalty_points_active:
        points = calculate_order_loyalty_points(locked_order)
        profile.points += points
        profile.save(update_fields=['points'])

        locked_order.loyalty_points = points
        locked_order.loyalty_points_active = True
        locked_order.save(update_fields=[
            'loyalty_points', 'loyalty_points_active', 'updated_at'
        ])
        if points:
            LoyaltyPointTransaction.objects.create(
                user=locked_order.user,
                order=locked_order,
                points_delta=points,
                balance_after=profile.points,
                reason=LoyaltyPointTransaction.Reason.ORDER_DELIVERED,
            )
        return points

    if locked_order.status != 'delivered' and locked_order.loyalty_points_active:
        deduction = min(profile.points, locked_order.loyalty_points)
        profile.points -= deduction
        profile.save(update_fields=['points'])

        locked_order.loyalty_points_active = False
        locked_order.save(update_fields=['loyalty_points_active', 'updated_at'])
        if deduction:
            LoyaltyPointTransaction.objects.create(
                user=locked_order.user,
                order=locked_order,
                points_delta=-deduction,
                balance_after=profile.points,
                reason=LoyaltyPointTransaction.Reason.ORDER_REVERSED,
            )
        return -deduction

    return 0
