from django.contrib.auth.models import User
from decimal import Decimal

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from shop.models import (
    AffiliateCommission,
    AffiliatePayout,
    AffiliateProfile,
    ContactInfo,
    ContactMessage,
    Coupon,
    Order,
    StorePage,
)
from shop.affiliate_payout_details import encrypt_payout_details


class AdminStoreContentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='content-admin',
            email='admin@example.com',
            password='test-password-123',
            is_staff=True,
        )
        self.client.force_authenticate(user=self.admin)
        self.page, _ = StorePage.objects.update_or_create(
            slug='privacy-policy',
            defaults={
                'title': 'Privacy policy',
                'content': 'Initial content',
                'content_type': StorePage.ContentType.MARKDOWN,
                'is_published': True,
            },
        )

    def test_admin_can_list_seeded_pages(self):
        response = self.client.get('/api/admin/pages/')
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 4)
        self.assertIn('privacy-policy', {page['slug'] for page in response.data})

    def test_admin_update_sanitizes_html_and_tracks_editor(self):
        response = self.client.put(
            '/api/admin/pages/privacy-policy/',
            {
                'title': 'Safe privacy policy',
                'title_en': 'Safe privacy policy',
                'title_ja': '安全なプライバシーポリシー',
                'title_vi': 'Chính sách bảo mật an toàn',
                'content': '<h2 onclick="bad()">Title</h2><script>alert(1)</script><a href="javascript:bad()">bad</a><a href="https://example.com" target="_blank">safe</a>',
                'content_en': '<p onclick="bad()">English</p>',
                'content_ja': '<script>bad()</script><p>日本語</p>',
                'content_vi': '<p>Tiếng Việt</p>',
                'content_type': 'html',
                'is_published': True,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.page.refresh_from_db()
        self.assertNotIn('script', self.page.content.lower())
        self.assertNotIn('onclick', self.page.content.lower())
        self.assertNotIn('javascript:', self.page.content.lower())
        self.assertIn('rel="noopener noreferrer"', self.page.content)
        self.assertNotIn('onclick', self.page.content_en.lower())
        self.assertNotIn('script', self.page.content_ja.lower())
        self.assertEqual(self.page.updated_by, self.admin)

    def test_non_admin_cannot_access_content_management(self):
        self.client.force_authenticate(user=User.objects.create_user('customer'))
        response = self.client.get('/api/admin/pages/')
        self.assertEqual(response.status_code, 403)

    def test_admin_can_update_contact_info(self):
        response = self.client.put(
            '/api/admin/contact-info/',
            {
                'phone': '+81 3 1234 5678',
                'email': 'hello@example.com',
                'address': 'Tokyo',
                'address_en': 'Tokyo, Japan',
                'address_ja': '日本、東京',
                'address_vi': 'Tokyo, Nhật Bản',
                'working_hours': '09:00 - 18:00',
                'working_hours_en': 'Monday - Friday',
                'working_hours_ja': '月曜日〜金曜日',
                'working_hours_vi': 'Thứ Hai - Thứ Sáu',
                'facebook_url': 'https://facebook.com/example',
                'zalo_url': 'https://zalo.me/example',
                'instagram_url': 'https://instagram.com/example',
                'tiktok_url': 'https://tiktok.com/@example',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(ContactInfo.objects.order_by('id').first().address, 'Tokyo')
        self.assertEqual(response.data['instagram_url'], 'https://instagram.com/example')
        self.assertEqual(response.data['tiktok_url'], 'https://tiktok.com/@example')
        self.assertEqual(response.data['address_ja'], '日本、東京')

    def test_admin_can_read_and_update_contact_message_status(self):
        message = ContactMessage.objects.create(
            name='Hanako', email='hanako@example.com', message='Hello',
        )
        list_response = self.client.get('/api/admin/contact-messages/')
        update_response = self.client.patch(
            f'/api/admin/contact-messages/{message.id}/',
            {'status': ContactMessage.Status.READ},
            format='json',
        )
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data[0]['email'], 'hanako@example.com')
        self.assertEqual(update_response.status_code, 200)
        message.refresh_from_db()
        self.assertEqual(message.status, ContactMessage.Status.READ)


class AdminCouponTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='coupon-admin', password='test-password-123', is_staff=True
        )
        self.client.force_authenticate(user=self.admin)

    def test_admin_can_create_and_normalize_coupon(self):
        response = self.client.post(
            '/api/admin/coupons/',
            {
                'code': ' welcome10 ',
                'description': 'Welcome discount',
                'discount_type': 'percentage',
                'discount_value': '10.00',
                'minimum_order_amount': '20.00',
                'maximum_discount_amount': '50.00',
                'usage_limit': 100,
                'per_user_limit': 1,
                'is_active': True,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        coupon = Coupon.objects.get()
        self.assertEqual(coupon.code, 'WELCOME10')
        self.assertEqual(coupon.created_by, self.admin)
        self.assertEqual(response.data['used_count'], 0)

    def test_percentage_cannot_exceed_one_hundred(self):
        response = self.client.post(
            '/api/admin/coupons/',
            {
                'code': 'BAD-PERCENT',
                'discount_type': 'percentage',
                'discount_value': '101.00',
                'per_user_limit': 1,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('discount_value', response.data)

    def test_customer_cannot_manage_coupons(self):
        self.client.force_authenticate(user=User.objects.create_user('regular-customer'))
        response = self.client.get('/api/admin/coupons/')
        self.assertEqual(response.status_code, 403)


class AdminAffiliateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='affiliate-admin', password='test-password-123', is_staff=True
        )
        self.customer = User.objects.create_user(
            username='partner-account', email='partner@example.com'
        )
        self.buyer = User.objects.create_user(
            username='affiliate-buyer', email='buyer@example.com'
        )
        self.client.force_authenticate(user=self.admin)

    def test_admin_creates_affiliate_and_bank_account_is_encrypted_and_masked(self):
        response = self.client.post(
            '/api/admin/affiliates/',
            {
                'user': self.customer.id,
                'code': ' partner01 ',
                'status': 'active',
                'commission_rate': '8.50',
                'cookie_days': 30,
                'bank_name': 'Example Bank',
                'account_name': 'Partner Account',
                'account_number': '123456789',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        affiliate = AffiliateProfile.objects.get()
        self.assertEqual(affiliate.code, 'PARTNER01')
        self.assertTrue(affiliate.payout_details_encrypted.startswith('enc:'))
        self.assertNotIn('123456789', affiliate.payout_details_encrypted)
        self.assertEqual(response.data['payout_details']['account_number'], '********6789')

    @override_settings(AFFILIATE_RETURN_WINDOW_DAYS=0, AFFILIATE_MIN_PAYOUT_USD='5.00')
    def test_order_delivery_payout_and_bank_transfer_lifecycle(self):
        affiliate = AffiliateProfile.objects.create(
            user=self.customer,
            code='PARTNER02',
            status=AffiliateProfile.Status.ACTIVE,
            commission_rate=Decimal('10.00'),
            payout_details_encrypted=encrypt_payout_details({
                'bank_name': 'Example Bank',
                'account_name': 'Partner Account',
                'account_number': '123456789',
            }),
        )
        order = Order.objects.create(
            user=self.buyer,
            payment_method='cash',
            subtotal_amount=Decimal('100.00'),
            total_amount=Decimal('100.00'),
            affiliate=affiliate,
            affiliate_code=affiliate.code,
            affiliate_commission_rate=affiliate.commission_rate,
        )
        commission = AffiliateCommission.objects.create(
            affiliate=affiliate,
            order=order,
            base_amount=Decimal('100.00'),
            commission_rate=Decimal('10.00'),
            amount=Decimal('10.00'),
        )

        delivery = self.client.patch(
            f'/api/admin/orders/{order.id}/', {'status': 'delivered'}, format='json'
        )
        self.assertEqual(delivery.status_code, 200)
        commission.refresh_from_db()
        self.assertEqual(commission.status, AffiliateCommission.Status.AVAILABLE)

        created = self.client.post(
            '/api/admin/affiliate-payouts/create-from-available/',
            {'affiliate': affiliate.id},
            format='json',
        )
        self.assertEqual(created.status_code, 201)
        payout = AffiliatePayout.objects.get()
        commission.refresh_from_db()
        self.assertEqual(payout.total_amount, Decimal('10.00'))
        self.assertEqual(payout.payout_details_encrypted, affiliate.payout_details_encrypted)
        self.assertEqual(commission.payout, payout)

        paid = self.client.post(
            f'/api/admin/affiliate-payouts/{payout.id}/mark-paid/',
            {'transaction_reference': 'BANK-TX-001'},
            format='json',
        )
        self.assertEqual(paid.status_code, 200)
        payout.refresh_from_db()
        commission.refresh_from_db()
        self.assertEqual(payout.status, AffiliatePayout.Status.PAID)
        self.assertEqual(commission.status, AffiliateCommission.Status.PAID)
        self.assertEqual(payout.transaction_reference, 'BANK-TX-001')
