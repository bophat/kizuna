from django.contrib.auth.models import User
from django.core import mail
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import patch

from .marketing import create_unsubscribe_token
from .models import (
    MarketingCampaign,
    MarketingEmailDelivery,
    MarketingEmailSuppression,
)


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    DEFAULT_FROM_EMAIL='KIZUNA <no-reply@example.test>',
    WEBSITE_URL='https://shop.example.test',
)
class MarketingCampaignApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username='admin', email='admin@example.test', password='password123'
        )
        self.customer_one = User.objects.create_user(
            username='customer-one',
            email='Customer@One.Example',
            password='password123',
            first_name='Lan',
        )
        self.customer_two = User.objects.create_user(
            username='customer-two', email='two@example.test', password='password123'
        )
        User.objects.create_user(
            username='inactive',
            email='inactive@example.test',
            password='password123',
            is_active=False,
        )
        User.objects.create_user(
            username='staff',
            email='staff@example.test',
            password='password123',
            is_staff=True,
        )
        self.client.force_authenticate(self.admin)

    def create_campaign(self):
        response = self.client.post(
            reverse('marketing-campaigns-list'),
            {
                'name': 'New event',
                'campaign_type': 'event',
                'subject': 'KIZUNA summer event',
                'body': 'Join our new event this weekend.',
                'cta_text': 'View event',
                'cta_url': 'https://shop.example.test/events/summer',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return MarketingCampaign.objects.get(pk=response.data['id'])

    def test_send_batch_targets_active_non_staff_customers_once(self):
        campaign = self.create_campaign()
        response = self.client.post(
            reverse('marketing-campaigns-send-batch', args=[campaign.pk]),
            {'batch_size': 50},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        campaign.refresh_from_db()
        self.assertEqual(campaign.status, MarketingCampaign.Status.SENT)
        self.assertEqual(campaign.recipient_count, 2)
        self.assertEqual(campaign.sent_count, 2)
        self.assertEqual(campaign.failed_count, 0)
        self.assertEqual(len(mail.outbox), 2)
        self.assertEqual(
            set(campaign.deliveries.values_list('email', flat=True)),
            {'customer@one.example', 'two@example.test'},
        )
        self.assertTrue(all('List-Unsubscribe' in message.extra_headers for message in mail.outbox))

        repeated = self.client.post(
            reverse('marketing-campaigns-send-batch', args=[campaign.pk]),
            {'batch_size': 50},
            format='json',
        )
        self.assertEqual(repeated.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 2)

    def test_suppressed_customer_is_not_added_to_campaign(self):
        MarketingEmailSuppression.objects.create(email='TWO@example.test')
        campaign = self.create_campaign()
        response = self.client.post(
            reverse('marketing-campaigns-send-batch', args=[campaign.pk]),
            {'batch_size': 50},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        campaign.refresh_from_db()
        self.assertEqual(campaign.recipient_count, 1)
        self.assertEqual(campaign.sent_count, 1)
        self.assertFalse(campaign.deliveries.filter(email='two@example.test').exists())

    def test_test_email_does_not_start_campaign(self):
        campaign = self.create_campaign()
        response = self.client.post(
            reverse('marketing-campaigns-send-test', args=[campaign.pk]),
            {'email': 'preview@example.test'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        campaign.refresh_from_db()
        self.assertEqual(campaign.status, MarketingCampaign.Status.DRAFT)
        self.assertEqual(MarketingEmailDelivery.objects.count(), 0)
        self.assertEqual(mail.outbox[0].to, ['preview@example.test'])

    def test_failed_delivery_can_be_retried_without_resending_successes(self):
        campaign = self.create_campaign()
        with patch(
            'admin_api.marketing.EmailMultiAlternatives.send',
            side_effect=RuntimeError('temporary smtp failure'),
        ):
            failed = self.client.post(
                reverse('marketing-campaigns-send-batch', args=[campaign.pk]),
                {'batch_size': 50},
                format='json',
            )
        self.assertEqual(failed.status_code, status.HTTP_200_OK)
        campaign.refresh_from_db()
        self.assertEqual(campaign.status, MarketingCampaign.Status.PARTIAL)
        self.assertEqual(campaign.failed_count, 2)

        retry = self.client.post(
            reverse('marketing-campaigns-retry-failed', args=[campaign.pk]),
            format='json',
        )
        self.assertEqual(retry.status_code, status.HTTP_200_OK, retry.data)
        sent = self.client.post(
            reverse('marketing-campaigns-send-batch', args=[campaign.pk]),
            {'batch_size': 50},
            format='json',
        )
        self.assertEqual(sent.status_code, status.HTTP_200_OK, sent.data)
        campaign.refresh_from_db()
        self.assertEqual(campaign.status, MarketingCampaign.Status.SENT)
        self.assertEqual(campaign.sent_count, 2)
        self.assertEqual(campaign.failed_count, 0)

    def test_campaign_cannot_be_edited_or_deleted_after_sending(self):
        campaign = self.create_campaign()
        self.client.post(
            reverse('marketing-campaigns-send-batch', args=[campaign.pk]),
            {'batch_size': 50},
            format='json',
        )
        update = self.client.patch(
            reverse('marketing-campaigns-detail', args=[campaign.pk]),
            {'subject': 'Changed'},
            format='json',
        )
        delete = self.client.delete(
            reverse('marketing-campaigns-detail', args=[campaign.pk])
        )
        self.assertEqual(update.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(delete.status_code, status.HTTP_400_BAD_REQUEST)

    def test_product_campaign_requires_a_product(self):
        response = self.client.post(
            reverse('marketing-campaigns-list'),
            {
                'name': 'New item',
                'campaign_type': 'product',
                'subject': 'New item',
                'body': 'See our new item.',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('product', response.data)


class MarketingUnsubscribeTests(APITestCase):
    def test_get_only_confirms_and_post_suppresses_address(self):
        token = create_unsubscribe_token('customer@example.test')
        url = reverse('marketing-unsubscribe')
        get_response = self.client.get(url, {'token': token})
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertFalse(MarketingEmailSuppression.objects.exists())

        post_response = self.client.post(
            f'{url}?token={token}',
            'List-Unsubscribe=One-Click',
            content_type='application/x-www-form-urlencoded',
        )
        self.assertEqual(post_response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            MarketingEmailSuppression.objects.filter(
                email='customer@example.test'
            ).exists()
        )

    def test_invalid_token_is_rejected(self):
        response = self.client.get(reverse('marketing-unsubscribe'), {'token': 'invalid'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
