"""Nudge customers who left items in their cart.

Run on a schedule (hourly is plenty). Reminders are deduped per cart per
"round" via CustomerNotification.dedupe_key, so re-running the command - or
running it more often than intended - will not re-notify the same customer.
"""

from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from shop.models import Cart, CustomerNotification, Order
from shop.notifications import notify


class Command(BaseCommand):
    help = (
        'Notify customers whose cart has sat untouched. Prints what it would '
        'do unless --execute is passed.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--hours',
            type=int,
            default=24,
            help='Remind about carts idle at least this long (default: 24).',
        )
        parser.add_argument(
            '--max-age-days',
            type=int,
            default=30,
            help='Ignore carts older than this, they are not coming back (default: 30).',
        )
        parser.add_argument(
            '--email',
            action='store_true',
            help='Also send an email alongside the in-app notification.',
        )
        parser.add_argument(
            '--execute',
            action='store_true',
            help='Actually create notifications. Without it this is a dry run.',
        )

    def handle(self, *args, **options):
        hours = options['hours']
        max_age_days = options['max_age_days']
        if hours < 1:
            raise CommandError('--hours must be at least 1.')
        if max_age_days < 1:
            raise CommandError('--max-age-days must be at least 1.')

        now = timezone.now()
        idle_before = now - timedelta(hours=hours)
        too_old_before = now - timedelta(days=max_age_days)

        # Guest carts have no user to notify, so only account carts qualify.
        carts = (
            Cart.objects.filter(
                user__isnull=False,
                updated_at__lt=idle_before,
                updated_at__gte=too_old_before,
            )
            .select_related('user')
            .prefetch_related('items__product')
        )

        notified = 0
        skipped_empty = 0
        skipped_duplicate = 0
        skipped_ordered = 0

        for cart in carts:
            items = [item for item in cart.items.all() if item.product]
            if not items:
                skipped_empty += 1
                continue

            # Don't chase someone who already checked out after touching the cart.
            if Order.objects.filter(
                user=cart.user, created_at__gte=cart.updated_at
            ).exists():
                skipped_ordered += 1
                continue

            first = items[0].product.name
            extra = len(items) - 1
            message = (
                f'{first} and {extra} more item(s) are waiting in your cart.'
                if extra > 0
                else f'{first} is waiting in your cart.'
            )
            # One reminder per idle stretch: the key changes only when the cart
            # is touched again.
            dedupe_key = f'cart-reminder:{cart.pk}:{cart.updated_at.isoformat()}'

            if not options['execute']:
                self.stdout.write(f'[dry-run] would remind {cart.user.email or cart.user.username}: {message}')
                notified += 1
                continue

            created = notify(
                cart.user,
                kind=CustomerNotification.Kind.CART,
                title='You left something behind',
                message=message,
                link='/cart',
                action_label='View cart',
                dedupe_key=dedupe_key,
            )
            if created is None:
                skipped_duplicate += 1
                continue
            notified += 1

            if options['email'] and cart.user.email:
                send_mail(
                    'Your KIZUNA cart is waiting',
                    message,
                    settings.DEFAULT_FROM_EMAIL,
                    [cart.user.email],
                    fail_silently=True,
                )

        verb = 'Would notify' if not options['execute'] else 'Notified'
        self.stdout.write(self.style.SUCCESS(
            f'{verb} {notified} customer(s). '
            f'Skipped: {skipped_empty} empty, {skipped_ordered} already ordered, '
            f'{skipped_duplicate} already reminded.'
        ))
