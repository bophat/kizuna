"""Rules for who may hold an account: a real name, and one email per person."""

from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIClient


class RegistrationRulesTests(TestCase):
    def setUp(self):
        # DRF throttling counts requests in the cache, which outlives the test
        # transaction. Without this the registration limit is shared with every
        # other test in the run and these start failing with 429 once the suite
        # grows.
        cache.clear()
        self.client = APIClient()
        self.payload = {
            'username': 'hanako',
            'email': 'hanako@example.com',
            'password': 'test-password-123',
            'first_name': 'Hanako',
            'last_name': 'Yamada',
        }

    def _register(self, **overrides):
        return self.client.post(
            '/api/register/', {**self.payload, **overrides}, format='json'
        )

    def test_registration_stores_the_name(self):
        response = self._register()
        self.assertEqual(response.status_code, 201, response.data)
        user = User.objects.get(username='hanako')
        self.assertEqual(user.get_full_name(), 'Hanako Yamada')

    def test_first_and_last_name_are_required(self):
        for field in ('first_name', 'last_name'):
            with self.subTest(field=field):
                payload = dict(self.payload)
                payload.pop(field)
                payload['username'] = f'user-missing-{field}'
                payload['email'] = f'missing-{field}@example.com'
                response = self.client.post('/api/register/', payload, format='json')
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.data)

    def test_whitespace_only_name_is_rejected(self):
        response = self._register(first_name='   ')
        self.assertEqual(response.status_code, 400)
        self.assertIn('first_name', response.data)

    def test_email_cannot_be_reused(self):
        self.assertEqual(self._register().status_code, 201)
        response = self._register(username='hanako2')
        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.data)

    def test_email_reuse_is_case_insensitive(self):
        self.assertEqual(self._register().status_code, 201)
        response = self._register(username='hanako3', email='HANAKO@example.com')
        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.data)

    def test_database_refuses_a_duplicate_email_even_outside_the_api(self):
        """The serializer is not the only way rows get created."""
        self._register()
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                User.objects.create_user(
                    username='sneaky',
                    email='Hanako@Example.com',
                    password='test-password-123',
                )

    def test_accounts_without_an_email_are_still_allowed(self):
        """The uniqueness rule is partial: blank addresses do not collide."""
        User.objects.create_user(username='no_email_1', password='test-password-123')
        User.objects.create_user(username='no_email_2', password='test-password-123')
        self.assertEqual(User.objects.filter(email='').count(), 2)
