# KIZUNA Backend — Settings Documentation

Tài liệu này mô tả chi tiết **tất cả cấu hình** của backend Django, được tổ chức theo chức năng. Mỗi section liệt kê biến môi trường, giá trị mặc định, và mục đích sử dụng.

---

## 📋 Mục lục

1. [Core — Cấu hình cốt lõi](#1-core--cấu-hình-cốt-lõi)
2. [Security — Bảo mật](#2-security--bảo-mật)
3. [Database — Kết nối CSDL](#3-database--kết-nối-csdl)
4. [Email — Gửi email](#4-email--gửi-email)
5. [REST Framework — API](#5-rest-framework--api)
6. [JWT Authentication — Xác thực token](#6-jwt-authentication--xác-thực-token)
7. [CORS / CSRF — Cross-origin requests](#7-cors--csrf--cross-origin-requests)
8. [Cache — Đệm dữ liệu](#8-cache--đệm-dữ-liệu)
9. [Storage — Lưu trữ file](#9-storage--lưu-trữ-file)
10. [i18n — Đa ngôn ngữ](#10-i18n--đa-ngôn-ngữ)
11. [Amazon/Qoo10 Source Import](#11-amazonqoo10-source-import)
12. [Pricing & Shipping — Tính giá & vận chuyển](#12-pricing--shipping--tính-giá--vận-chuyển)
13. [Image Download — Tải hình ảnh](#13-image-download--tải-hình-ảnh)
14. [Price Sync — Đồng bộ giá](#14-price-sync--đồng-bộ-giá)
15. [SePay — Xác minh bank transfer](#15-sepay--xác-minh-bank-transfer)
16. [Affiliate — Hoa hồng & cộng tác viên](#16-affiliate--hoa-hồng--cộng-tác-viên)
17. [Chatbot — AI trò chuyện](#17-chatbot--ai-trò-chuyện)
18. [Birthday — Couple sinh nhật](#18-birthday--couple-sinh-nhật)
19. [MCP — Model Context Protocol](#19-mcp--model-context-protocol)
20. [Deployment — Render / Cloud Run](#20-deployment--render--cloud-run)

---

## 1. Core — Cấu hình cốt lõi

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `DJANGO_SECRET_KEY` | `django-insecure-dummy-key-for-dev` | Secret key mã hóa session, CSRF token, JWT. **Bắt buộc đổi trong production**. |
| `DJANGO_DEBUG` | `True` | Bật/tắt chế độ debug. `True` → hiển thị lỗi chi tiết, CORS mở. **Phải `False` trong production**. |
| `DJANGO_ALLOWED_HOSTS` | `*` | Danh sách host/domain được phép truy cập. Phân tách bằng dấu phẩy. Production: `kizuna-api.onrender.com,localhost,127.0.0.1` |

> **File**: `core/settings.py` dòng 8-14

---

## 2. Security — Bảo mật

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `SECURE_SSL_REDIRECT` | `True` (chỉ khi `DEBUG=False`) | Tự động redirect HTTP → HTTPS. Bật trong production. |
| `SECURE_PROXY_SSL_HEADER` | `('HTTP_X_FORWARDED_PROTO', 'https')` | Cho phép Render/Cloud Run reverse proxy set HTTPS header. |
| `USE_X_FORWARDED_HOST` | `True` | Tin tưởng `X-Forwarded-Host` từ reverse proxy. |

> **File**: `core/settings.py` dòng 16-18, 328-333

---

## 3. Database — Kết nối CSDL

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `DATABASE_URL` | *(không có → SQLite)* | Connection string PostgreSQL (Render tự inject). Format: `postgres://user:pass@host:5432/dbname` |

**Logic**:
- **Có `DATABASE_URL`** → dùng PostgreSQL qua `dj_database_url`
- **Không có** → fallback SQLite tại `web/database/db.sqlite3`

> **File**: `core/settings.py` dòng 101-119

---

## 4. Email — Gửi email

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `EMAIL_BACKEND` | `console.EmailBackend` (dev) / `smtp.EmailBackend` (prod) | Backend gửi email. Console in debug, SMTP trong production. |
| `EMAIL_HOST` | `localhost` | SMTP server hostname. |
| `EMAIL_PORT` | `587` | SMTP port. 587 cho TLS, 465 cho SSL. |
| `EMAIL_HOST_USER` | *(empty)* | SMTP username. |
| `EMAIL_HOST_PASSWORD` | *(empty)* | SMTP password. |
| `EMAIL_USE_TLS` | `True` | Bật TLS. |
| `EMAIL_USE_SSL` | `False` | Bật SSL (không dùng chung với TLS). |
| `EMAIL_TIMEOUT` | `10` | Timeout kết nối SMTP (giây). |
| `DEFAULT_FROM_EMAIL` | `KIZUNA <no-reply@localhost>` | Email người gửi mặc định. |
| `EMAIL_VERIFICATION_TIMEOUT` | `86400` (24h) | Link xác thực email hết hạn sau bao nhiêu giây. |
| `PASSWORD_RESET_TIMEOUT` | `3600` (1h) | Link reset password hết hạn sau bao nhiêu giây. |
| `WEBSITE_URL` | `http://localhost:3000` | URL gốc của website (dùng trong email links). |

> **File**: `core/settings.py` dòng 35-56

---

## 5. REST Framework — API

| Thiết lập | Giá trị | Mô tả |
|-----------|---------|-------|
| `DEFAULT_AUTHENTICATION_CLASSES` | CookieJWT + JWTAuthentication | Hỗ trợ cả cookie-based và Authorization header. |
| `DEFAULT_THROTTLE_CLASSES` | AnonRateThrottle + UserRateThrottle | Giới hạn tốc độ request chung. |
| Anon throttle | `120/hour` | Request/giờ cho user chưa đăng nhập. |
| User throttle | `600/hour` | Request/giờ cho user đã đăng nhập. |

### Throttle theo endpoint riêng

| Endpoint | Giới hạn | Lý do |
|----------|----------|-------|
| `login` | 20/hour | Chống brute-force |
| `register` | 10/hour | Chống spam đăng ký |
| `verify_email` | 30/hour | Chống abuse |
| `resend_verification` | 5/hour | Rất hạn chế |
| `password_reset_request` | 5/hour | Chống spam |
| `password_reset_confirm` | 20/hour | Chống brute-force |
| `password_change_request` | 5/hour | Chống spam |
| `concierge` | 30/hour | Chat AI tốn resource |
| `contact_submit` | 5/hour | Chống spam contact form |

> **File**: `core/settings.py` dòng 173-196

---

## 6. JWT Authentication — Xác thực token

| Thiết lập | Giá trị | Mô tả |
|-----------|---------|-------|
| `ACCESS_TOKEN_LIFETIME` | 60 phút | Token truy cập hết hạn. |
| `REFRESH_TOKEN_LIFETIME` | 7 ngày | Token làm mới hết hạn. |
| `SLIDING_TOKEN_REFRESH_LIFETIME` | 1 ngày | Thời gian autorefresh token. |
| `CHECK_REVOKE_TOKEN` | `True` | Kiểm tra token đã bị thu hồi chưa (logout). |

**Auth Backend**: Hỗ trợ đăng nhập bằng **email** (không phải username) qua `users.backends.EmailBackend`.

> **File**: `core/settings.py` dòng 198-208

---

## 7. CORS / CSRF — Cross-origin requests

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `CORS_ALLOWED_ORIGINS` | *(empty → `*` all khi DEBUG)* | Domain frontend được phép gọi API. Phân tách bằng dấu phẩy. |
| `CORS_ALLOW_CREDENTIALS` | `True` | Cho phép gửi cookie (JWT trong cookie). |
| `CSRF_TRUSTED_ORIGINS` | *(empty)* | Domain tin cậy cho CSRF check. |

**Vercel production setup**:
```
CORS_ALLOWED_ORIGINS=https://kizuna-admin.vercel.app,https://kizuna-website.vercel.app
CSRF_TRUSTED_ORIGINS=https://kizuna-admin.vercel.app,https://kizuna-website.vercel.app,https://kizuna-api.onrender.com
```

> **File**: `core/settings.py` dòng 210-224

---

## 8. Cache — Đệm dữ liệu

| Thiết lập | Giá trị | Mô tả |
|-----------|---------|-------|
| Backend | `LocMemCache` | In-memory cache (per-process). Production nên dùng Redis. |
| `EXCHANGE_RATE_CACHE_SECONDS` | `3600` (1h) | Cache tỷ giá ngoại tệ. |
| `PUBLIC_API_CACHE_SECONDS` | `0` (dev) / `60` (prod) | Cache response API public. |

> **File**: `core/settings.py` dòng 226-236

---

## 9. Storage — Lưu trữ file

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `STATIC_URL` | `/static/` | URL prefix cho static files (CSS, JS, images). |
| `STATIC_ROOT` | `staticfiles/` | Thư mục collect static files (WhiteNoise). |
| `MEDIA_URL` | `/media/` | URL prefix cho user-uploaded files (product images, avatars). |
| `MEDIA_ROOT` | `backend/media/` | Thư mục lưu media trên disk. |
| `GCS_BUCKET_NAME` | *(empty)* | Nếu có → upload media lên Google Cloud Storage thay vì local disk. |

**Logic storage**:
- **`GCS_BUCKET_NAME` trống** → `FileSystemStorage` (local disk)
- **`GCS_BUCKET_NAME` có giá trị** → `CloudRunMediaStorage` (GCS, dùng service account của Cloud Run)

> **File**: `core/settings.py` dòng 147-169

---

## 10. i18n — Đa ngôn ngữ

| Thiết lập | Giá trị | Mô tả |
|-----------|---------|-------|
| `LANGUAGE_CODE` | `en-us` | Ngôn ngữ mặc định. |
| `LANGUAGES` | `en`, `ja`, `vi` | 3 ngôn ngữ hỗ trợ: English, Japanese, Vietnamese. |
| `TIME_ZONE` | `UTC` | Múi giờ server. |
| `USE_I18N` | `True` | Bật dịch thuật. |
| `USE_TZ` | `True` | Bật timezone-aware datetimes. |
| `LocaleMiddleware` | Đã thêm | Tự động detect ngôn ngữ từ header `Accept-Language`. |

> **File**: `core/settings.py` dòng 67-79, 137-145

---

## 11. Amazon/Qoo10 Source Import

### General

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `SOURCE_IMPORT_USE_FAKE_PROVIDERS` | `True` (dev) / `False` (prod) | Dùng fake provider cho development. **Phải `False` trong production**. |
| `SOURCE_IMPORT_PUBLIC_PAGE_FALLBACK_ENABLED` | `True` | Nếu provider API lỗi, fallback sang scrape HTML public page. |
| `SOURCE_IMPORT_MAX_BATCH` | `50` | Số URL tối đa mỗi lần bulk import. |
| `ALLOW_AUTO_CREATE_CATEGORY` | `False` | Tự động tạo category nếu không tìm thấy. |
| `SOURCE_PROVIDER_TIMEOUT_SECONDS` | `10` | Timeout gọi provider API. |
| `SOURCE_PROVIDER_MAX_ATTEMPTS` | `3` | Số lần retry tối đa khi provider lỗi. |

### Public Page Scraper (fallback)

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `SOURCE_IMPORT_PUBLIC_PAGE_MAX_BYTES` | `4194304` (4MB) | Giới hạn kích thước HTML response. |
| `SOURCE_IMPORT_PUBLIC_PAGE_TIMEOUT_SECONDS` | `15` | Timeout fetch HTML page. |
| `SOURCE_IMPORT_PUBLIC_PAGE_MAX_REDIRECTS` | `3` | Số redirect tối đa theo dõi. |
| `SOURCE_IMPORT_PUBLIC_PAGE_CACHE_SECONDS` | `900` (15min) | Cache HTML response để giảm request. |

### Amazon Creators API

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `AMAZON_CREATORS_CREDENTIAL_ID` | *(empty)* | Credential ID từ Amazon Associates > Creators API. |
| `AMAZON_CREATORS_CREDENTIAL_SECRET` | *(empty)* | Secret key tương ứng. |
| `AMAZON_CREATORS_CREDENTIAL_VERSION` | `3.3` | Version của Creators API. |
| `AMAZON_JP_PARTNER_TAG` | *(empty)* | Associate ID (partner tag) cho Amazon Japan. |

### Qoo10 QAPI

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `QOO10_CERTIFICATION_KEY` | *(empty)* | QAPI certification key từ Qoo10 Seller Center. |

> **File**: `core/settings.py` dòng 249-319, `.env.example` dòng 63-104

---

## 12. Pricing & Shipping — Tính giá & vận chuyển

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `USD_VND_RATE` | `25000` | Tỷ giá USD → VND. |
| `SOURCE_IMPORT_JPY_BUFFER` | `1000` JPY | Buffer thêm vào giá nguồn (đệm rủi ro tỷ giá). |
| `SOURCE_IMPORT_JPY_TO_VND_RATE` | `200` | Tỷ giá JPY → VND để tính giá bán. |
| `SOURCE_IMPORT_MARKUP_RATE` | `0.15` (15%) | Phần trăm markup lên giá nguồn. |
| `SOURCE_IMPORT_LIGHT_SHIPPING_VND` | `20000` VND | Phí ship cho hàng nhẹ (< 0.5kg). |
| `SOURCE_IMPORT_HEAVY_SHIPPING_PER_KG_VND` | `180000` VND/kg | Phí ship/kg cho hàng nặng (≥ 0.5kg). |
| `SOURCE_IMPORT_HEAVY_WEIGHT_THRESHOLD_KG` | `0.5` | Ngưỡng phân loại hàng nhẹ/nặng (kg). |

**Công tính giá bán**:
```
Giá nguồn (JPY) + JPY_BUFFER → JPY/VND rate → Giá nguồn VND
Giá bán = Giá nguồn VND × (1 + MARKUP_RATE)
Phí ship = weight < 0.5kg ? LIGHT : weight × HEAVY_PER_KG
```

> **File**: `core/settings.py` dòng 250-291, `product_sources/services/pricing_service.py`

---

## 13. Image Download — Tải hình ảnh

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `SOURCE_IMPORT_IMAGE_DOWNLOAD_ENABLED` | `False` | Bật/tắt tải hình từ provider. **Chuẩn bị bản quyền trước khi bật**. |
| `SOURCE_IMPORT_IMAGE_MAX_BYTES` | `10485760` (10MB) | Kích thước file ảnh tối đa. |
| `SOURCE_IMPORT_IMAGE_MAX_PIXELS` | `40000000` (40MP) | Số pixel tối đa. |
| `SOURCE_IMPORT_IMAGE_TIMEOUT_SECONDS` | `10` | Timeout tải ảnh. |
| `SOURCE_IMPORT_IMAGE_MAX_REDIRECTS` | `3` | Số redirect tối đa. |

> **File**: `core/settings.py` dòng 297-316

---

## 14. Price Sync — Đồng bộ giá

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `AUTO_UPDATE_MAX_INCREASE_PERCENT` | `5` | Nếu giá mới tăng >5% so với giá cũ → tự động **không** update, chuyển sang review. |
| `REVIEW_PRICE_INCREASE_PERCENT` | `15` | Nếu giá mới tăng >15% → đánh dấu cần admin duyệt. |

**Logic auto-update**:
- Giá mới giống cũ / giảm / tăng ≤5% → auto-update
- Tăng 5-15% → giữ giá cũ, đánh dấu review
- Tăng >15% / sản phẩm không còn tồn tại → tạm dừng bán
- Stock về 0 → gỡ bỏ kho

> **File**: `core/settings.py` dòng 317-318, `product_sources/services/sync_service.py`

---

## 15. SePay — Xác minh bank transfer

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `SEPAY_WEBHOOK_SECRET` | *(empty)* | HMAC-SHA256 secret để xác minh webhook từ SePay. |
| `SEPAY_WEBHOOK_MAX_AGE_SECONDS` | `300` (5 phút) | Webhook cũ hơn 5 phút bị reject (chống replay attack). |

> **File**: `core/settings.py` dòng 243-247

---

## 16. Affiliate — Hoa hồng & cộng tác viên

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `AFFILIATE_RETURN_WINDOW_DAYS` | `14` | Số ngày khách hàng được hoàn trả → affiliate bị trừ commission. |
| `AFFILIATE_MIN_PAYOUT_USD` | `20.00` | Số dư tối thiểu (USD) để nhà cung cấp yêu cầu rút tiền. |

> **File**: `core/settings.py` dòng 321-322

---

## 17. Chatbot — AI trò chuyện

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `CHATBOT_INTERNAL_TOKEN` | *(empty)* | Shared secret giữa Django backend và chatbot service để xác thực internal calls. |
| `CHATBOT_SERVICE_URL` | `http://127.0.0.1:8080` | URL của chatbot Flask service. |

> **File**: `core/settings.py` dòng 325-326

---

## 18. Birthday — Couple sinh nhật

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `BIRTHDAY_EMAIL_TIME_ZONE` | `Asia/Ho_Chi_Minh` | Múi giờ để tính ngày sinh nhật user. |
| `BIRTHDAY_COUPON_DISCOUNT_PERCENT` | `10` | % giảm giá coupon sinh nhật. |
| `BIRTHDAY_COUPON_MINIMUM_ORDER_VND` | `300000` | Giá trị đơn hàng tối thiểu để dùng coupon. |
| `BIRTHDAY_COUPON_MAX_DISCOUNT_VND` | `100000` | Giảm tối đa VND (cap). |

> **File**: `core/settings.py` dòng 54-65

---

## 19. MCP — Model Context Protocol

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `MCP_SYSTEM_USERNAME` | `mcp_system_user` | Username của system user dùng cho MCP write operations. Phải tạo user này trước. |

> **File**: `core/settings.py` dòng 319

---

## 20. Deployment — Render / Cloud Run

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `MEDIA_ROOT` | `backend/media/` | Thư mục media. Render: `/var/data/media`. Cloud Run: dùng GCS. |
| `GCS_BUCKET_NAME` | *(empty)* | Tên GCS bucket cho media. Khi set → dùng Cloud Storage thay local. |
| `EXCHANGE_RATE_API_URL` | `https://api.frankfurter.app/latest?from=USD&to=VND,JPY` | API lấy tỷ giá ngoại tệ. |

### Cloud Storage (`GCS_BUCKET_NAME`)
Khi biến này có giá trị, hệ thống tự động:
- Đổi storage backend từ `FileSystemStorage` → `CloudRunMediaStorage`
- Upload media lên GCS bucket
- Dùng service account của Cloud Run (không cần JSON key)

### Packages cần thiết

| Package | Mục đích |
|---------|----------|
| `django` (6.0.7) | Web framework |
| `djangorestframework` (3.17.1) | REST API |
| `django-cors-headers` | CORS handling |
| `django-filter` | Query parameter filtering |
| `django-allauth` | Social auth |
| `djangorestframework-simplejwt` | JWT tokens |
| `dj-database-url` | Parse DATABASE_URL cho Render |
| `whitenoise` | Static files serving |
| `google-cloud-storage` | GCS upload |
| `Pillow` | Image processing |
| `reportlab` | PDF generation (invoice) |

---

## 📁 File locations

| File | Vị trí | Mô tả |
|------|--------|-------|
| `core/settings.py` | `web/backend/core/` | Tất cả cấu hình Django |
| `.env` | `web/backend/.env` | Values production (gitignored) |
| `.env.example` | `web/backend/.env.example` | Template cho .env |
| `requirements.txt` | `web/backend/` | Python dependencies |
| `settings.md` | `web/SETTINGS.md` | ← Tài liệu bạn đang đọc |

---

## 🔧 Quick reference: Setup production (Render)

```bash
# Bắt buộc
DJANGO_SECRET_KEY=<random-64-char-string>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=kizuna-api.onrender.com
DATABASE_URL=<render-postgres-url>
CORS_ALLOWED_ORIGINS=https://kizuna-admin.vercel.app,https://kizuna-website.vercel.app
CSRF_TRUSTED_ORIGINS=https://kizuna-admin.vercel.app,https://kizuna-website.vercel.app

# Email
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=<app-password>
DEFAULT_FROM_EMAIL=KIZUNA <no-reply@your-domain.com>

# Amazon
AMAZON_CREATORS_CREDENTIAL_ID=<id>
AMAZON_CREATORS_CREDENTIAL_SECRET=<secret>
AMAZON_JP_PARTNER_TAG=<partner-tag>

# Qoo10 (optional)
QOO10_CERTIFICATION_KEY=<key>

# Optional
GCS_BUCKET_NAME=your-bucket-name
EXCHANGE_RATE_CACHE_SECONDS=3600
```

---

*Generated for `core/settings.py` + `.env.example` — Last updated: 2026-08-14*
