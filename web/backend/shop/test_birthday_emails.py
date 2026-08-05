from datetime import date
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.conf import settings
from django.contrib.auth.models import User
from django.core import mail
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from admin_api.models import MarketingEmailSuppression

from .birthday_coupons import issue_birthday_coupon
from .birthday_emails import (
    process_birthday_emails,
    send_birthday_email_for_customer,
)
from .coupons import CouponValidationError, validate_coupon
from .models import (
    BirthdayEmailDelivery,
    Coupon,
    CouponRedemption,
    Order,
    UserProfile,
)


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    DEFAULT_FROM_EMAIL='KIZUNA <no-reply@example.test>',
    WEBSITE_URL='https://shop.example.test',
)
class BirthdayEmailTests(TestCase):
    def create_customer(self, username, email, birthday, **profile_fields):
        user = User.objects.create_user(
            username=username,
            email=email,
            password='password123',
            first_name=username.title(),
        )
        UserProfile.objects.create(
            user=user,
            date_of_birth=birthday,
            **profile_fields,
        )
        return user

    def test_sends_once_per_customer_per_year_in_preferred_language(self):
        user = self.create_customer(
            'lan',
            'LAN@example.test',
            date(1992, 8, 5),
            preferred_language='vi',
        )

        first = process_birthday_emails(date(2026, 8, 5))
        second = process_birthday_emails(date(2026, 8, 5))

        self.assertEqual(first['sent'], 1)
        self.assertEqual(second['already_sent'], 1)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('chúc mừng sinh nhật', mail.outbox[0].subject)
        coupon = Coupon.objects.get(
            source=Coupon.Source.BIRTHDAY,
            assigned_user=user,
            birthday_year=2026,
        )
        self.assertEqual(coupon.discount_value, 10)
        self.assertEqual(coupon.amount_currency, Coupon.AmountCurrency.VND)
        self.assertEqual(coupon.minimum_order_amount, 300000)
        self.assertEqual(coupon.maximum_discount_amount, 100000)
        self.assertEqual(coupon.usage_limit, 1)
        self.assertIsNone(coupon.expires_at)
        self.assertIn(coupon.code, mail.outbox[0].body)
        delivery = BirthdayEmailDelivery.objects.get(user=user, birthday_year=2026)
        self.assertEqual(delivery.status, BirthdayEmailDelivery.Status.SENT)
        self.assertEqual(delivery.attempt_count, 1)

    def test_suppressed_and_disabled_customers_are_not_sent(self):
        suppressed = self.create_customer(
            'suppressed', 'suppressed@example.test', date(1990, 8, 5)
        )
        self.create_customer(
            'disabled',
            'disabled@example.test',
            date(1990, 8, 5),
            birthday_email_enabled=False,
        )
        MarketingEmailSuppression.objects.create(email=suppressed.email.upper())

        result = process_birthday_emails(date(2026, 8, 5))

        self.assertEqual(result['suppressed'], 1)
        self.assertEqual(result['sent'], 0)
        self.assertEqual(BirthdayEmailDelivery.objects.count(), 0)

    def test_failed_delivery_can_be_retried(self):
        user = self.create_customer(
            'retry', 'retry@example.test', date(1990, 8, 5)
        )
        with patch(
            'shop.birthday_emails.EmailMultiAlternatives.send',
            side_effect=RuntimeError('temporary SMTP failure'),
        ):
            failed = process_birthday_emails(date(2026, 8, 5))

        retried = process_birthday_emails(date(2026, 8, 5))

        self.assertEqual(failed['failed'], 1)
        self.assertEqual(retried['sent'], 1)
        delivery = BirthdayEmailDelivery.objects.get(user=user, birthday_year=2026)
        self.assertEqual(delivery.status, BirthdayEmailDelivery.Status.SENT)
        self.assertEqual(delivery.attempt_count, 2)

    def test_february_29_birthdays_send_on_february_28_in_non_leap_year(self):
        self.create_customer(
            'leap', 'leap@example.test', date(1992, 2, 29)
        )

        result = process_birthday_emails(date(2026, 2, 28))

        self.assertEqual(result['sent'], 1)

    def test_dry_run_does_not_send_or_create_delivery(self):
        self.create_customer('dry', 'dry@example.test', date(1990, 8, 5))

        result = process_birthday_emails(date(2026, 8, 5), dry_run=True)

        self.assertEqual(result['recipients'], ['dry@example.test'])
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(BirthdayEmailDelivery.objects.count(), 0)
        self.assertEqual(Coupon.objects.count(), 0)

    def test_existing_sent_email_without_coupon_gets_one_coupon_follow_up(self):
        user = self.create_customer(
            'legacy', 'legacy@example.test', date(1990, 8, 5)
        )
        BirthdayEmailDelivery.objects.create(
            user=user,
            birthday_year=2026,
            email=user.email,
            status=BirthdayEmailDelivery.Status.SENT,
            attempt_count=1,
            sent_at=timezone.now(),
        )

        first = send_birthday_email_for_customer(user, date(2026, 8, 5))
        second = send_birthday_email_for_customer(user, date(2026, 8, 5))

        self.assertEqual(first['status'], 'sent')
        self.assertIn('coupon_code', first)
        self.assertEqual(second['status'], 'already_sent')
        self.assertEqual(second['coupon_code'], first['coupon_code'])
        self.assertEqual(len(mail.outbox), 1)


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    DEFAULT_FROM_EMAIL='KIZUNA <no-reply@example.test>',
    WEBSITE_URL='https://shop.example.test',
)
class BirthdayProfileApiTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            username='customer', email='customer@example.test', password='password123'
        )
        self.admin = User.objects.create_superuser(
            username='admin', email='admin@example.test', password='password123'
        )
        self.client = APIClient()

    def test_customer_can_save_birthday_and_email_preference(self):
        self.client.force_authenticate(self.customer)
        response = self.client.patch(
            '/api/shop/me/',
            {
                'date_of_birth': '1994-08-05',
                'preferred_language': 'ja',
                'birthday_email_enabled': False,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['profile']['date_of_birth'], '1994-08-05')
        self.assertEqual(response.data['profile']['preferred_language'], 'ja')
        self.assertFalse(response.data['profile']['birthday_email_enabled'])

    def test_future_birthday_is_rejected(self):
        self.client.force_authenticate(self.customer)
        response = self.client.patch(
            '/api/shop/me/',
            {'date_of_birth': '2999-01-01'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_admin_birthday_test_is_sent_to_admin_not_customer(self):
        UserProfile.objects.create(
            user=self.customer,
            date_of_birth=date(1994, 8, 5),
            preferred_language='en',
        )
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f'/api/admin/users/{self.customer.pk}/send-birthday-email-test/',
            {'language': 'en'},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['sent_to'], self.admin.email)
        self.assertEqual(mail.outbox[0].to, [self.admin.email])
        self.assertEqual(BirthdayEmailDelivery.objects.count(), 0)
        self.assertEqual(Coupon.objects.count(), 0)
        self.assertIn('BDAY-PREVIEW', mail.outbox[0].body)

    def test_admin_can_update_customer_birthday_preferences(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f'/api/admin/users/{self.customer.pk}/',
            {
                'date_of_birth': '1995-12-24',
                'preferred_language': 'vi',
                'birthday_email_enabled': True,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['date_of_birth'], '1995-12-24')
        self.assertEqual(response.data['preferred_language'], 'vi')
        self.assertTrue(response.data['birthday_email_enabled'])

    def test_admin_can_manually_send_todays_birthday_email_to_customer_once(self):
        run_date = timezone.localdate(
            timezone=ZoneInfo(settings.BIRTHDAY_EMAIL_TIME_ZONE)
        )
        birth_year = 2000 if (run_date.month, run_date.day) == (2, 29) else 1994
        UserProfile.objects.create(
            user=self.customer,
            date_of_birth=date(birth_year, run_date.month, run_date.day),
            preferred_language='vi',
        )
        self.client.force_authenticate(self.admin)
        url = f'/api/admin/users/{self.customer.pk}/send-birthday-email/'

        sent = self.client.post(url, format='json')
        repeated = self.client.post(url, format='json')

        self.assertEqual(sent.status_code, 200, sent.data)
        self.assertEqual(sent.data['status'], 'sent')
        self.assertEqual(sent.data['sent_to'], self.customer.email)
        self.assertIn('coupon_code', sent.data)
        self.assertEqual(repeated.status_code, 200, repeated.data)
        self.assertEqual(repeated.data['status'], 'already_sent')
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.customer.email])

    def test_admin_manual_send_requires_a_birthday_today(self):
        run_date = timezone.localdate(
            timezone=ZoneInfo(settings.BIRTHDAY_EMAIL_TIME_ZONE)
        )
        wrong_birthday = date(1994, 1, 2) if (run_date.month, run_date.day) == (1, 1) else date(1994, 1, 1)
        UserProfile.objects.create(
            user=self.customer,
            date_of_birth=wrong_birthday,
        )
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            f'/api/admin/users/{self.customer.pk}/send-birthday-email/',
            format='json',
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(response.data['error_code'], 'not_birthday')
        self.assertEqual(len(mail.outbox), 0)


@override_settings(
    BIRTHDAY_COUPON_DISCOUNT_PERCENT=10,
    BIRTHDAY_COUPON_MINIMUM_ORDER_VND=300000,
    BIRTHDAY_COUPON_MAX_DISCOUNT_VND=100000,
)
class BirthdayCouponValidationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username='coupon-owner', email='owner@example.test', password='password123'
        )
        self.other = User.objects.create_user(
            username='coupon-other', email='other@example.test', password='password123'
        )
        self.coupon, _ = issue_birthday_coupon(self.owner, 2026)

    @patch('shop.coupons.get_exchange_rates', return_value={'usd_to_vnd': 25000})
    def test_coupon_is_bound_to_owner_and_vnd_limits_are_converted(self, _rates):
        discount = validate_coupon(self.coupon, self.owner, 20)
        self.assertEqual(discount, 2)

        with self.assertRaises(CouponValidationError) as exc:
            validate_coupon(self.coupon, self.other, 20)
        self.assertEqual(exc.exception.code, 'not_assigned')

        with self.assertRaises(CouponValidationError) as exc:
            validate_coupon(self.coupon, self.owner, 10)
        self.assertEqual(exc.exception.code, 'minimum_order_not_met')

    def test_coupon_has_no_expiry_and_only_one_issue_per_year(self):
        repeated, created = issue_birthday_coupon(self.owner, 2026)

        self.assertFalse(created)
        self.assertEqual(repeated.pk, self.coupon.pk)
        self.assertIsNone(self.coupon.expires_at)
        self.assertEqual(self.coupon.usage_limit, 1)
        self.assertEqual(self.coupon.per_user_limit, 1)

    @patch('shop.coupons.get_exchange_rates', return_value={'usd_to_vnd': 25000})
    def test_coupon_cannot_be_reused_and_an_order_cannot_stack_coupons(self, _rates):
        order = Order.objects.create(
            user=self.owner,
            payment_method='cash',
            subtotal_amount=20,
            discount_amount=2,
            total_amount=18,
            coupon=self.coupon,
            coupon_code=self.coupon.code,
        )
        CouponRedemption.objects.create(
            coupon=self.coupon,
            user=self.owner,
            order=order,
            discount_amount=2,
        )
        self.coupon.used_count = 1
        self.coupon.save(update_fields=['used_count', 'updated_at'])

        with self.assertRaises(CouponValidationError) as exc:
            validate_coupon(self.coupon, self.owner, 20)
        self.assertEqual(exc.exception.code, 'usage_limit_reached')

        second_coupon = Coupon.objects.create(
            code='SECOND10',
            discount_type=Coupon.DiscountType.PERCENTAGE,
            discount_value=10,
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            CouponRedemption.objects.create(
                coupon=second_coupon,
                user=self.owner,
                order=order,
                discount_amount=2,
            )
