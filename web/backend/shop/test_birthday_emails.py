from datetime import date
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from admin_api.models import MarketingEmailSuppression

from .birthday_emails import process_birthday_emails
from .models import BirthdayEmailDelivery, UserProfile


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
