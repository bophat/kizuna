from django.contrib.auth.models import User
from django.core import mail
from django.core.mail.backends.base import BaseEmailBackend
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from .cookie_auth import ACCESS_COOKIE, REFRESH_COOKIE
from .email_verification import create_verification_token


class FailingEmailBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        raise OSError('SMTP is unavailable')


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    DEFAULT_FROM_EMAIL='KIZUNA <no-reply@example.test>',
    WEBSITE_URL='https://shop.example.test',
    EMAIL_VERIFICATION_TIMEOUT=86400,
)
class EmailVerificationTests(APITestCase):
    register_payload = {
        'username': 'new_customer',
        'email': 'Customer@Example.com',
        'password': 'safe-password-123',
    }

    def register(self, **overrides):
        payload = {**self.register_payload, **overrides}
        return self.client.post(
            '/api/register/',
            payload,
            format='json',
            HTTP_ACCEPT_LANGUAGE='vi',
        )

    def test_registration_creates_inactive_user_and_sends_localized_email(self):
        response = self.register()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['code'], 'verification_email_sent')
        user = User.objects.get(username='new_customer')
        self.assertFalse(user.is_active)
        self.assertEqual(user.email, 'customer@example.com')
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Xác minh', mail.outbox[0].subject)
        self.assertIn('https://shop.example.test/verify-email?token=', mail.outbox[0].body)

    def test_valid_token_activates_user_and_allows_login(self):
        self.register()
        user = User.objects.get(username='new_customer')

        blocked = self.client.post(
            '/api/login/',
            {'email': user.email, 'password': self.register_payload['password']},
            format='json',
        )
        self.assertEqual(blocked.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(blocked.data['code'], 'email_not_verified')

        verified = self.client.post(
            '/api/verify-email/',
            {'token': create_verification_token(user)},
            format='json',
        )
        self.assertEqual(verified.status_code, status.HTTP_200_OK)
        self.assertEqual(verified.data['code'], 'email_verified')
        user.refresh_from_db()
        self.assertTrue(user.is_active)

        logged_in = self.client.post(
            '/api/login/',
            {'email': user.email, 'password': self.register_payload['password']},
            format='json',
        )
        self.assertEqual(logged_in.status_code, status.HTTP_200_OK)
        self.assertIn(ACCESS_COOKIE, logged_in.cookies)
        self.assertIn(REFRESH_COOKIE, logged_in.cookies)

    def test_verification_is_idempotent(self):
        self.register()
        user = User.objects.get(username='new_customer')
        token = create_verification_token(user)

        first = self.client.post('/api/verify-email/', {'token': token}, format='json')
        second = self.client.post('/api/verify-email/', {'token': token}, format='json')

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)

    def test_invalid_token_is_rejected(self):
        response = self.client.post(
            '/api/verify-email/',
            {'token': 'tampered-token'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'verification_invalid')

    @override_settings(EMAIL_VERIFICATION_TIMEOUT=-1)
    def test_expired_token_is_rejected(self):
        user = User.objects.create_user(
            username='expired',
            email='expired@example.com',
            password='safe-password-123',
            is_active=False,
        )

        response = self.client.post(
            '/api/verify-email/',
            {'token': create_verification_token(user)},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'verification_expired')

    def test_duplicate_email_is_rejected_case_insensitively(self):
        User.objects.create_user(
            username='existing',
            email='customer@example.com',
            password='safe-password-123',
        )

        response = self.register(email='CUSTOMER@example.com')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_resend_is_generic_and_only_emails_inactive_accounts(self):
        inactive = User.objects.create_user(
            username='inactive',
            email='inactive@example.com',
            password='safe-password-123',
            is_active=False,
        )
        active = User.objects.create_user(
            username='active',
            email='active@example.com',
            password='safe-password-123',
        )

        missing_response = self.client.post(
            '/api/resend-verification/',
            {'email': 'missing@example.com'},
            format='json',
        )
        active_response = self.client.post(
            '/api/resend-verification/',
            {'email': active.email},
            format='json',
        )
        inactive_response = self.client.post(
            '/api/resend-verification/',
            {'email': inactive.email},
            format='json',
        )

        self.assertEqual(missing_response.status_code, status.HTTP_200_OK)
        self.assertEqual(active_response.status_code, status.HTTP_200_OK)
        self.assertEqual(inactive_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [inactive.email])

    def test_staff_created_user_is_active_without_verification_email(self):
        admin = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='safe-password-123',
        )
        self.client.force_authenticate(admin)

        response = self.client.post(
            '/api/users/',
            {
                'username': 'staff_created_customer',
                'email': 'staff-created@example.com',
                'password': 'safe-password-123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.get(username='staff_created_customer').is_active)
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(EMAIL_BACKEND='users.tests.FailingEmailBackend')
    def test_email_failure_rolls_back_registration(self):
        response = self.register()

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data['code'], 'verification_delivery_failed')
        self.assertFalse(User.objects.filter(username='new_customer').exists())
