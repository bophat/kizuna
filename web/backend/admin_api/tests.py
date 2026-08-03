from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from shop.models import ContactInfo, ContactMessage, StorePage


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
