"""Creating customer-facing notifications.

Every sender goes through notify() so the dedupe rule is applied in one place:
a notification carrying a dedupe_key is only ever created once per customer,
which is what makes status syncs and the cart reminder safe to re-run.
"""

from django.db import IntegrityError

from .models import CustomerNotification


ORDER_STATUS_MESSAGES = {
    'processing': (
        'Order {code} confirmed',
        'We have your order and are preparing it for dispatch.',
    ),
    'shipped': (
        'Order {code} is on its way',
        'Your order has left the studio and is in transit.',
    ),
    'delivered': (
        'Order {code} delivered',
        'Your order has arrived. We would love to hear what you think of it.',
    ),
    'cancelled': (
        'Order {code} cancelled',
        'This order has been cancelled. Contact us if that was not expected.',
    ),
}


def notify(user, *, kind, title, message='', link='', action_label='', dedupe_key=''):
    """Create a notification, or return None if the dedupe key already fired."""
    if user is None:
        return None
    try:
        return CustomerNotification.objects.create(
            user=user,
            kind=kind,
            title=title,
            message=message,
            link=link,
            action_label=action_label,
            dedupe_key=dedupe_key,
        )
    except IntegrityError:
        # Already sent for this dedupe key.
        return None


def notify_order_status(order):
    """Announce an order reaching a status the customer cares about."""
    template = ORDER_STATUS_MESSAGES.get(order.status)
    if not template:
        return None
    title, message = template
    return notify(
        order.user,
        kind=CustomerNotification.Kind.ORDER,
        title=title.format(code=order.order_code),
        message=message,
        link='/order-history',
        action_label='View order',
        dedupe_key=f'order:{order.pk}:{order.status}',
    )


def notify_payment_received(order):
    return notify(
        order.user,
        kind=CustomerNotification.Kind.PAYMENT,
        title=f'Payment received for {order.order_code}',
        message='Thank you — your payment has been confirmed.',
        link='/order-history',
        action_label='View order',
        dedupe_key=f'payment-paid:{order.pk}',
    )
