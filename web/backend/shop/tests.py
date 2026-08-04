from unittest.mock import patch
from datetime import timedelta
from decimal import Decimal
import base64
import hashlib
import hmac
import json
import time
from urllib.parse import parse_qs, urlparse

from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .concierge_store import sessions_for_admin
from .models import (
    AffiliateCommission,
    AffiliateProfile,
    AffiliateVisit,
    Cart,
    CartItem,
    Category,
    ConciergeSession,
    ContactInfo,
    ContactMessage,
    Coupon,
    CouponRedemption,
    Order,
    PaymentMethodConfig,
    PaymentTransaction,
    PaymentWebhookEvent,
    Product,
    StorePage,
)
from .affiliates import refresh_available_commissions, sync_order_commission


ONE_PIXEL_PNG = base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
)


class PublicCatalogLocalizationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(
            name='Original category',
            name_en='English category',
            name_ja='日本語カテゴリー',
            name_vi='Danh mục tiếng Việt',
            slug='localized-category',
        )
        Product.objects.create(
            id='I18N-001',
            name='Original product',
            name_en='English product',
            name_ja='日本語の商品',
            name_vi='Sản phẩm tiếng Việt',
            description='Original description',
            description_en='English description',
            description_ja='日本語の説明',
            description_vi='Mô tả tiếng Việt',
            category=self.category,
            price='10.00',
        )

    def test_product_and_category_follow_accept_language(self):
        expected = {
            'en': ('English product', 'English description', 'English category'),
            'ja': ('日本語の商品', '日本語の説明', '日本語カテゴリー'),
            'vi': ('Sản phẩm tiếng Việt', 'Mô tả tiếng Việt', 'Danh mục tiếng Việt'),
        }

        for language, values in expected.items():
            with self.subTest(language=language):
                response = self.client.get(
                    '/api/shop/products/I18N-001/',
                    HTTP_ACCEPT_LANGUAGE=language,
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    (response.data['name'], response.data['description'], response.data['category']),
                    values,
                )

    def test_missing_translation_falls_back_to_original_content(self):
        product = Product.objects.get(pk='I18N-001')
        product.name_vi = ''
        product.save(update_fields=['name_vi'])

        response = self.client.get(
            '/api/shop/products/I18N-001/',
            HTTP_ACCEPT_LANGUAGE='vi',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name'], 'Original product')

    def test_api_errors_follow_accept_language(self):
        response = self.client.get(
            '/api/shop/products/DOES-NOT-EXIST/',
            HTTP_ACCEPT_LANGUAGE='ja',
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data['detail'], '該当するデータが見つかりません。')

    def test_home_endpoint_returns_small_localized_sections(self):
        product = Product.objects.get(pk='I18N-001')
        product.is_new = True
        product.is_featured = True
        product.save(update_fields=['is_new', 'is_featured'])

        response = self.client.get(
            '/api/shop/products/home/',
            HTTP_ACCEPT_LANGUAGE='vi',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['new_arrivals'][0]['name'], 'Sản phẩm tiếng Việt')
        self.assertEqual(response.data['featured'][0]['name'], 'Sản phẩm tiếng Việt')
        self.assertLessEqual(len(response.data['new_arrivals']), 3)
        self.assertLessEqual(len(response.data['featured']), 4)

    def test_related_endpoint_excludes_current_product(self):
        Product.objects.create(
            id='I18N-002',
            name='Related product',
            description='Related description',
            category=self.category,
            price='12.00',
        )

        response = self.client.get('/api/shop/products/I18N-001/related/')

        self.assertEqual(response.status_code, 200)
        returned_ids = [item['id'] for item in response.data]
        self.assertIn('I18N-002', returned_ids)
        self.assertNotIn('I18N-001', returned_ids)

    @patch('shop.views.PUBLIC_API_CACHE_SECONDS', 60)
    def test_home_endpoint_uses_cache_after_first_request(self):
        cache.clear()
        first = self.client.get('/api/shop/products/home/')
        self.assertEqual(first.status_code, 200)

        with self.assertNumQueries(0):
            second = self.client.get('/api/shop/products/home/')

        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.data, first.data)
        cache.clear()


class ConciergeCustomerIdentityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='hanako',
            email='hanako@example.com',
            first_name='Hanako',
            last_name='Yamada',
            password='test-password-123',
        )

    @patch('shop.concierge_store.is_ai_enabled', return_value=False)
    def test_authenticated_message_exposes_profile_name_to_admin(self, _mock_ai):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            '/api/shop/concierge/message/',
            {'session_id': 'web_authenticated', 'message': 'hello'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        session = ConciergeSession.objects.get(session_id='web_authenticated')
        self.assertEqual(session.user, self.user)

        admin_session = sessions_for_admin()['web_authenticated']
        self.assertEqual(admin_session['customer_name'], 'hanako@example.com')
        self.assertEqual(admin_session['customer_display_name'], 'Hanako Yamada')
        self.assertEqual(admin_session['customer_email'], 'hanako@example.com')
        self.assertEqual(admin_session['customer_username'], 'hanako')

    @patch('shop.concierge_store.is_ai_enabled', return_value=False)
    def test_customer_name_falls_back_to_username(self, _mock_ai):
        self.user.first_name = ''
        self.user.last_name = ''
        self.user.email = ''
        self.user.save(update_fields=['first_name', 'last_name', 'email'])
        self.client.force_authenticate(user=self.user)

        self.client.post(
            '/api/shop/concierge/message/',
            {'session_id': 'web_username', 'message': 'hello'},
            format='json',
        )

        admin_session = sessions_for_admin()['web_username']
        self.assertEqual(admin_session['customer_name'], 'hanako')

    @patch('shop.concierge_store.is_ai_enabled', return_value=False)
    def test_authenticated_history_claims_existing_guest_session(self, _mock_ai):
        self.client.post(
            '/api/shop/concierge/message/',
            {'session_id': 'web_guest_then_login', 'message': 'hello'},
            format='json',
        )
        session = ConciergeSession.objects.get(session_id='web_guest_then_login')
        self.assertIsNone(session.user_id)

        self.client.force_authenticate(user=self.user)
        response = self.client.get(
            '/api/shop/concierge/history/?session_id=web_guest_then_login'
        )

        self.assertEqual(response.status_code, 200)
        session.refresh_from_db()
        self.assertEqual(session.user, self.user)
        self.assertEqual(
            sessions_for_admin()['web_guest_then_login']['customer_name'],
            'hanako@example.com',
        )

    @patch('shop.concierge_store.is_ai_enabled', return_value=False)
    def test_login_cookie_identifies_concierge_customer(self, _mock_ai):
        login = self.client.post(
            '/api/login/',
            {'email': 'hanako@example.com', 'password': 'test-password-123'},
            format='json',
        )
        self.assertEqual(login.status_code, 200)

        response = self.client.post(
            '/api/shop/concierge/message/',
            {'session_id': 'web_cookie_authenticated', 'message': 'hello'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            sessions_for_admin()['web_cookie_authenticated']['customer_email'],
            'hanako@example.com',
        )


class PublicStoreContentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.page, _ = StorePage.objects.update_or_create(
            slug='privacy-policy',
            defaults={
                'title': 'Privacy policy',
                'content': '## Safe content',
                'title_en': 'Privacy Policy',
                'title_ja': 'プライバシーポリシー',
                'title_vi': 'Chính sách bảo mật',
                'content_en': '## Safe English content',
                'content_ja': '## 安全な日本語コンテンツ',
                'content_vi': '## Nội dung tiếng Việt an toàn',
                'content_type': StorePage.ContentType.MARKDOWN,
                'is_published': True,
            },
        )

    def test_published_page_is_public(self):
        response = self.client.get('/api/pages/privacy-policy/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['slug'], 'privacy-policy')
        self.assertEqual(response.data['title'], 'Privacy Policy')
        self.assertEqual(response.data['content'], '## Safe English content')
        self.assertNotIn('is_published', response.data)

    def test_page_content_follows_accept_language(self):
        expected = {
            'en': ('Privacy Policy', '## Safe English content'),
            'ja': ('プライバシーポリシー', '## 安全な日本語コンテンツ'),
            'vi': ('Chính sách bảo mật', '## Nội dung tiếng Việt an toàn'),
        }
        for language, values in expected.items():
            with self.subTest(language=language):
                response = self.client.get(
                    '/api/pages/privacy-policy/',
                    HTTP_ACCEPT_LANGUAGE=language,
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual((response.data['title'], response.data['content']), values)

    def test_unpublished_page_returns_404(self):
        self.page.is_published = False
        self.page.save(update_fields=['is_published'])
        response = self.client.get('/api/pages/privacy-policy/')
        self.assertEqual(response.status_code, 404)

    def test_contact_info_is_public(self):
        info = ContactInfo.objects.order_by('id').first() or ContactInfo.objects.create()
        info.phone = '+84 123 456 789'
        info.email = 'hello@example.com'
        info.instagram_url = 'https://www.instagram.com/kizuna'
        info.tiktok_url = 'https://www.tiktok.com/@kizuna'
        info.address_en = 'Tokyo, Japan'
        info.address_ja = '日本、東京'
        info.address_vi = 'Tokyo, Nhật Bản'
        info.working_hours_en = 'Monday - Friday'
        info.working_hours_ja = '月曜日〜金曜日'
        info.working_hours_vi = 'Thứ Hai - Thứ Sáu'
        info.save()
        response = self.client.get('/api/contact-info/', HTTP_ACCEPT_LANGUAGE='ja')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['phone'], '+84 123 456 789')
        self.assertEqual(response.data['email'], 'hello@example.com')
        self.assertEqual(response.data['instagram_url'], 'https://www.instagram.com/kizuna')
        self.assertEqual(response.data['tiktok_url'], 'https://www.tiktok.com/@kizuna')
        self.assertEqual(response.data['address'], '日本、東京')
        self.assertEqual(response.data['working_hours'], '月曜日〜金曜日')

    def test_contact_form_saves_message(self):
        response = self.client.post(
            '/api/contact/submit/',
            {'name': 'Hanako', 'email': 'hanako@example.com', 'message': 'Please contact me.'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        message = ContactMessage.objects.get()
        self.assertEqual(message.name, 'Hanako')
        self.assertEqual(message.status, ContactMessage.Status.UNREAD)

    def test_contact_form_rejects_empty_message(self):
        response = self.client.post(
            '/api/contact/submit/',
            {'name': 'Hanako', 'email': 'hanako@example.com', 'message': '   '},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(ContactMessage.objects.exists())


class CouponCheckoutTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='coupon-customer',
            email='coupon@example.com',
            password='test-password-123',
        )
        self.client.force_authenticate(user=self.user)
        self.product = Product.objects.create(
            id='COUPON-PRODUCT',
            name='Coupon product',
            description='Product for coupon tests',
            price=Decimal('100.00'),
            stock=10,
            weight=Decimal('0.30'),
            status='published',
        )
        self.cart = Cart.objects.create(user=self.user)
        # Deliberately use a forged cart price. Checkout must ignore it.
        CartItem.objects.create(
            cart=self.cart,
            product=self.product,
            quantity=2,
            price=Decimal('1.00'),
        )
        self.coupon = Coupon.objects.create(
            code='save10',
            discount_type=Coupon.DiscountType.PERCENTAGE,
            discount_value=Decimal('10.00'),
            minimum_order_amount=Decimal('50.00'),
            usage_limit=10,
            per_user_limit=1,
        )

    def test_coupon_preview_uses_current_product_price(self):
        response = self.client.post(
            '/api/shop/coupons/validate/', {'code': ' save10 '}, format='json'
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['code'], 'SAVE10')
        self.assertEqual(response.data['subtotal_amount'], Decimal('200.00'))
        self.assertEqual(response.data['discount_amount'], Decimal('20.00'))

    @patch('shop.shipping.get_exchange_rates', return_value={'usd_to_vnd': 25000})
    def test_checkout_applies_coupon_and_recalculates_complete_total(self, _rates):
        response = self.client.post(
            '/api/shop/checkout/process_checkout/',
            {
                'email': self.user.email,
                'first_name': 'Coupon',
                'last_name': 'Customer',
                'phone': '0900000000',
                'address': 'Tokyo',
                'payment_method': 'cash',
                'coupon_code': 'save10',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        order = Order.objects.get()
        self.assertEqual(order.subtotal_amount, Decimal('200.00'))
        self.assertEqual(order.shipping_amount, Decimal('4.00'))
        self.assertEqual(order.discount_amount, Decimal('20.00'))
        self.assertEqual(order.total_amount, Decimal('184.00'))
        self.assertEqual(order.coupon_code, 'SAVE10')
        self.assertEqual(order.items.get().price, Decimal('100.00'))
        self.assertTrue(CouponRedemption.objects.filter(order=order, user=self.user).exists())
        self.coupon.refresh_from_db()
        self.assertEqual(self.coupon.used_count, 1)

    def test_coupon_rejects_minimum_order_and_expired_period(self):
        self.coupon.minimum_order_amount = Decimal('250.00')
        self.coupon.save()
        minimum_response = self.client.post(
            '/api/shop/coupons/validate/', {'code': 'SAVE10'}, format='json'
        )
        self.assertEqual(minimum_response.status_code, 400)
        self.assertEqual(minimum_response.data['error_code'], 'minimum_order_not_met')

        self.coupon.minimum_order_amount = Decimal('0.00')
        self.coupon.expires_at = timezone.now() - timedelta(minutes=1)
        self.coupon.save()
        expired_response = self.client.post(
            '/api/shop/coupons/validate/', {'code': 'SAVE10'}, format='json'
        )
        self.assertEqual(expired_response.status_code, 400)
        self.assertEqual(expired_response.data['error_code'], 'expired')

    def test_fixed_discount_never_reduces_subtotal_below_zero(self):
        self.coupon.discount_type = Coupon.DiscountType.FIXED
        self.coupon.discount_value = Decimal('500.00')
        self.coupon.save()

        response = self.client.post(
            '/api/shop/coupons/validate/', {'code': 'SAVE10'}, format='json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['discount_amount'], Decimal('200.00'))
        self.assertEqual(response.data['total_after_discount'], Decimal('0.00'))


class AffiliateProgramTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            username='affiliate-customer',
            email='buyer@example.com',
            password='test-password-123',
        )
        self.partner_user = User.objects.create_user(
            username='affiliate-partner',
            email='partner@example.com',
            password='test-password-123',
        )
        self.partner = AffiliateProfile.objects.create(
            user=self.partner_user,
            code='kenji10',
            status=AffiliateProfile.Status.ACTIVE,
            commission_rate=Decimal('10.00'),
            cookie_days=30,
        )
        self.product = Product.objects.create(
            id='AFFILIATE-PRODUCT',
            name='Affiliate product',
            description='Product for affiliate tests',
            price=Decimal('100.00'),
            stock=10,
            weight=Decimal('0.30'),
            status='published',
        )

    def _authenticate_customer_with_cart(self, user=None):
        user = user or self.customer
        self.client.force_authenticate(user=user)
        cart = Cart.objects.create(user=user)
        CartItem.objects.create(
            cart=cart,
            product=self.product,
            quantity=2,
            price=self.product.price,
        )

    def _checkout(self, **overrides):
        payload = {
            'email': self.customer.email,
            'first_name': 'Affiliate',
            'last_name': 'Customer',
            'phone': '0900000000',
            'address': 'Tokyo',
            'payment_method': 'cash',
            'affiliate_code': self.partner.code,
        }
        payload.update(overrides)
        return self.client.post(
            '/api/shop/checkout/process_checkout/', payload, format='json'
        )

    def test_tracking_accepts_active_code_and_counts_session_once(self):
        payload = {
            'code': ' kenji10 ',
            'session_id': 'browser-session-1',
            'landing_path': '/products/example?ref=KENJI10',
        }
        first = self.client.post('/api/shop/affiliates/track/', payload, format='json')
        second = self.client.post('/api/shop/affiliates/track/', payload, format='json')

        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.data['code'], 'KENJI10')
        self.assertEqual(second.status_code, 200)
        self.assertEqual(AffiliateVisit.objects.filter(affiliate=self.partner).count(), 1)

        self.partner.status = AffiliateProfile.Status.SUSPENDED
        self.partner.save()
        rejected = self.client.post(
            '/api/shop/affiliates/track/',
            {**payload, 'session_id': 'browser-session-2'},
            format='json',
        )
        self.assertEqual(rejected.status_code, 404)

    @patch('shop.shipping.get_exchange_rates', return_value={'usd_to_vnd': 25000})
    def test_checkout_creates_commission_without_counting_shipping(self, _rates):
        self._authenticate_customer_with_cart()
        response = self._checkout()

        self.assertEqual(response.status_code, 200)
        order = Order.objects.get()
        commission = AffiliateCommission.objects.get(order=order)
        self.assertEqual(order.affiliate, self.partner)
        self.assertEqual(order.affiliate_attribution_source, 'link')
        self.assertEqual(order.shipping_amount, Decimal('4.00'))
        self.assertEqual(commission.base_amount, Decimal('200.00'))
        self.assertEqual(commission.amount, Decimal('20.00'))
        self.assertEqual(commission.status, AffiliateCommission.Status.PENDING)

    @patch('shop.shipping.get_exchange_rates', return_value={'usd_to_vnd': 25000})
    def test_affiliate_coupon_overrides_referral_link(self, _rates):
        coupon_user = User.objects.create_user(
            username='coupon-partner', email='coupon-partner@example.com'
        )
        coupon_partner = AffiliateProfile.objects.create(
            user=coupon_user,
            code='COUPONPARTNER',
            status=AffiliateProfile.Status.ACTIVE,
            commission_rate=Decimal('5.00'),
        )
        Coupon.objects.create(
            code='PARTNER10',
            discount_type=Coupon.DiscountType.PERCENTAGE,
            discount_value=Decimal('10.00'),
            per_user_limit=1,
            affiliate=coupon_partner,
        )
        self._authenticate_customer_with_cart()
        response = self._checkout(coupon_code='PARTNER10')

        self.assertEqual(response.status_code, 200)
        order = Order.objects.get()
        commission = AffiliateCommission.objects.get(order=order)
        self.assertEqual(order.affiliate, coupon_partner)
        self.assertEqual(order.affiliate_attribution_source, 'coupon')
        self.assertEqual(commission.base_amount, Decimal('180.00'))
        self.assertEqual(commission.amount, Decimal('9.00'))

    @patch('shop.shipping.get_exchange_rates', return_value={'usd_to_vnd': 25000})
    def test_self_referral_is_not_commissioned(self, _rates):
        self._authenticate_customer_with_cart(self.partner_user)
        response = self._checkout(email=self.partner_user.email)

        self.assertEqual(response.status_code, 200)
        order = Order.objects.get()
        self.assertIsNone(order.affiliate)
        self.assertFalse(AffiliateCommission.objects.exists())

    @override_settings(AFFILIATE_RETURN_WINDOW_DAYS=0)
    def test_delivered_commission_becomes_available_and_cancel_reverses_it(self):
        order = Order.objects.create(
            user=self.customer,
            payment_method='cash',
            subtotal_amount=Decimal('100.00'),
            total_amount=Decimal('100.00'),
            affiliate=self.partner,
            affiliate_code=self.partner.code,
            affiliate_commission_rate=self.partner.commission_rate,
        )
        commission = AffiliateCommission.objects.create(
            affiliate=self.partner,
            order=order,
            base_amount=Decimal('100.00'),
            commission_rate=Decimal('10.00'),
            amount=Decimal('10.00'),
        )
        order.status = 'delivered'
        order.save(update_fields=['status'])
        sync_order_commission(order, 'shipped')
        refresh_available_commissions()
        commission.refresh_from_db()
        self.assertEqual(commission.status, AffiliateCommission.Status.AVAILABLE)

        order.status = 'cancelled'
        order.save(update_fields=['status'])
        sync_order_commission(order, 'delivered')
        commission.refresh_from_db()
        self.assertEqual(commission.status, AffiliateCommission.Status.REVERSED)


class CartStockValidationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='cart-customer',
            email='cart@example.com',
            password='test-password-123',
        )
        self.product = Product.objects.create(
            id='CART-STOCK-PRODUCT',
            name='Limited product',
            price=Decimal('10.00'),
            stock=2,
            status='published',
        )
        self.client.force_authenticate(user=self.user)

    def test_add_item_rejects_quantity_above_stock(self):
        response = self.client.post(
            '/api/shop/cart/add_item/',
            {'product_id': self.product.pk, 'quantity': 3},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['cart_error_code'], 'insufficient_stock')
        self.assertEqual(response.data['available_stock'], 2)
        self.assertFalse(CartItem.objects.exists())

    def test_add_item_rejects_combined_quantity_above_stock(self):
        first = self.client.post(
            '/api/shop/cart/add_item/',
            {'product_id': self.product.pk, 'quantity': 1},
            format='json',
        )
        second = self.client.post(
            '/api/shop/cart/add_item/',
            {'product_id': self.product.pk, 'quantity': 2},
            format='json',
        )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 400)
        self.assertEqual(CartItem.objects.get().quantity, 1)

    def test_update_item_rejects_quantity_above_stock(self):
        cart = Cart.objects.create(user=self.user)
        item = CartItem.objects.create(
            cart=cart,
            product=self.product,
            quantity=1,
            price=self.product.price,
        )

        response = self.client.post(
            '/api/shop/cart/update_item/',
            {'product_id': self.product.pk, 'quantity': 3},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['cart_error_code'], 'insufficient_stock')
        item.refresh_from_db()
        self.assertEqual(item.quantity, 1)


class PaymentCheckoutTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='payment-customer',
            email='payment@example.com',
            password='test-password-123',
        )
        self.product = Product.objects.create(
            id='PAYMENT-PRODUCT',
            name='Payment product',
            price=Decimal('10.00'),
            stock=5,
            weight=Decimal('0.30'),
            status='published',
        )
        self.client.force_authenticate(user=self.user)

    def create_cart(self):
        cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(
            cart=cart,
            product=self.product,
            quantity=1,
            price=self.product.price,
        )

    def checkout(self, method):
        return self.client.post(
            '/api/shop/checkout/process_checkout/',
            {
                'email': self.user.email,
                'first_name': 'Payment',
                'last_name': 'Customer',
                'phone': '0900000000',
                'address': 'Tokyo',
                'payment_method': method,
            },
            format='json',
        )

    def enable_bank_transfer(self):
        method = PaymentMethodConfig.objects.get(code='bank_transfer')
        method.enabled = True
        method.bank_name = 'Test Bank'
        method.bank_bin = '970436'
        method.account_name = 'KIZUNA SHOP'
        method.account_number = '123456789'
        method.currency = 'VND'
        method.save()
        return method

    def test_public_endpoint_only_returns_enabled_methods(self):
        response = self.client.get(
            '/api/shop/payment-methods/', HTTP_ACCEPT_LANGUAGE='vi'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['code'] for item in response.data], ['cod'])
        self.assertIn('Thanh toán', response.data[0]['instructions'])

    def test_cod_checkout_is_ready_for_fulfillment(self):
        self.create_cart()
        response = self.checkout('cash')

        self.assertEqual(response.status_code, 200)
        order = Order.objects.get()
        self.assertEqual(order.payment_method, 'cod')
        self.assertEqual(order.status, 'processing')
        self.assertEqual(order.payment.status, PaymentTransaction.Status.COD_PENDING)

    def test_disabled_bank_transfer_is_rejected_without_creating_order(self):
        self.create_cart()
        response = self.checkout('bank_transfer')

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_empty_cart_returns_structured_checkout_error(self):
        response = self.checkout('cod')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['checkout_error_code'], 'empty_cart')

    def test_insufficient_stock_returns_product_details(self):
        self.create_cart()
        self.product.stock = 0
        self.product.save(update_fields=['stock'])

        response = self.checkout('cod')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['checkout_error_code'], 'insufficient_stock')
        self.assertEqual(response.data['product_name'], self.product.name)
        self.assertEqual(response.data['available_stock'], 0)
        self.assertFalse(Order.objects.exists())

    @patch('shop.payments.get_exchange_rates', return_value={'usd_to_vnd': 25000})
    def test_bank_transfer_checkout_and_receipt_upload(self, _rates):
        self.enable_bank_transfer()
        self.create_cart()
        response = self.checkout('bank_transfer')

        self.assertEqual(response.status_code, 200)
        order = Order.objects.get()
        self.assertEqual(order.status, 'pending')
        self.assertEqual(order.payment.status, PaymentTransaction.Status.PENDING)
        self.assertEqual(order.payment.settlement_currency, 'VND')
        self.assertEqual(response.data['order']['order_code'], order.payment.reference)
        qr_code_url = response.data['payment']['qr_code_url']
        self.assertTrue(qr_code_url.startswith('https://img.vietqr.io/'))
        query = parse_qs(urlparse(qr_code_url).query)
        self.assertEqual(query['amount'], [str(int(order.payment.settlement_amount))])
        self.assertEqual(query['addInfo'], [order.payment.reference])

        receipt = SimpleUploadedFile('receipt.png', ONE_PIXEL_PNG, content_type='image/png')
        uploaded = self.client.post(
            f'/api/shop/orders/{order.id}/payment-proof/',
            {'receipt': receipt},
            format='multipart',
        )
        self.assertEqual(uploaded.status_code, 200)
        order.payment.refresh_from_db()
        self.assertEqual(order.payment.status, PaymentTransaction.Status.PROOF_SUBMITTED)
        self.assertIsNotNone(order.payment.proof_submitted_at)


@override_settings(
    SEPAY_WEBHOOK_SECRET='sepay-test-secret',
    SEPAY_WEBHOOK_MAX_AGE_SECONDS=300,
)
class SepayPaymentWebhookTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='sepay-customer',
            email='sepay@example.com',
            password='test-password-123',
        )
        self.order = Order.objects.create(
            user=self.user,
            payment_method='bank_transfer',
            status='pending',
            total_amount=Decimal('13.00'),
        )
        self.payment = PaymentTransaction.objects.create(
            order=self.order,
            method=PaymentMethodConfig.Code.BANK_TRANSFER,
            status=PaymentTransaction.Status.PENDING,
            amount_usd=Decimal('13.00'),
            settlement_amount=Decimal('325000'),
            settlement_currency='VND',
            exchange_rate=Decimal('25000'),
            reference=f'KZ{self.order.id:010d}',
            method_snapshot={'account_number': '123456789'},
            expires_at=timezone.now() + timedelta(hours=1),
        )

    def payload(self, **overrides):
        payload = {
            'id': 987654,
            'gateway': 'Test Bank',
            'accountNumber': '123456789',
            'code': None,
            'content': f'{self.payment.reference} thanh toan don hang',
            'transferType': 'in',
            'transferAmount': 325000,
            'referenceCode': 'BANK-REFERENCE-001',
        }
        payload.update(overrides)
        return payload

    def post_webhook(self, payload, secret='sepay-test-secret', timestamp=None):
        timestamp = int(time.time()) if timestamp is None else timestamp
        body = json.dumps(payload, separators=(',', ':')).encode('utf-8')
        signed_payload = str(timestamp).encode('utf-8') + b'.' + body
        signature = 'sha256=' + hmac.new(
            secret.encode('utf-8'), signed_payload, hashlib.sha256
        ).hexdigest()
        return self.client.post(
            '/api/shop/payments/webhooks/sepay/',
            data=body,
            content_type='application/json',
            HTTP_X_SEPAY_SIGNATURE=signature,
            HTTP_X_SEPAY_TIMESTAMP=str(timestamp),
        )

    def test_matching_credit_marks_payment_paid_and_releases_order(self):
        response = self.post_webhook(self.payload())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'success': True})
        self.payment.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentTransaction.Status.PAID)
        self.assertEqual(self.payment.provider, 'sepay')
        self.assertIsNotNone(self.payment.paid_at)
        self.assertEqual(self.order.status, 'processing')
        event = PaymentWebhookEvent.objects.get()
        self.assertEqual(event.status, PaymentWebhookEvent.Status.PROCESSED)
        self.assertEqual(event.reason, 'payment_confirmed')
        self.assertEqual(event.payment, self.payment)

    def test_duplicate_event_is_idempotent(self):
        payload = self.payload()
        first = self.post_webhook(payload)
        second = self.post_webhook(payload)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(PaymentWebhookEvent.objects.count(), 1)

    def test_invalid_signature_is_rejected(self):
        response = self.post_webhook(self.payload(), secret='wrong-secret')

        self.assertEqual(response.status_code, 401)
        self.assertFalse(PaymentWebhookEvent.objects.exists())
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentTransaction.Status.PENDING)

    def test_wrong_amount_is_logged_without_settling_payment(self):
        response = self.post_webhook(self.payload(transferAmount=324999))

        self.assertEqual(response.status_code, 200)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentTransaction.Status.PENDING)
        event = PaymentWebhookEvent.objects.get()
        self.assertEqual(event.status, PaymentWebhookEvent.Status.IGNORED)
        self.assertEqual(event.reason, 'settlement_amount_mismatch')

    def test_wrong_bank_account_is_logged_without_settling_payment(self):
        response = self.post_webhook(self.payload(accountNumber='000000000'))

        self.assertEqual(response.status_code, 200)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentTransaction.Status.PENDING)
        event = PaymentWebhookEvent.objects.get()
        self.assertEqual(event.reason, 'bank_account_mismatch')
