# Spec: Chức năng trang Chính sách / Điều khoản / Giao hàng & Trả hàng / Liên hệ

## 1. Bối cảnh

Footer hiện có 4 link nhưng chưa có trang/nội dung tương ứng:
- Chính sách bảo mật
- Điều khoản dịch vụ
- Giao hàng & trả hàng
- Liên hệ

Yêu cầu: admin có thể **tự soạn/sửa nội dung** các trang này từ màn hình admin, không cần deploy lại code (trừ trang Liên hệ có thể có thêm form).

---

## 2. Database

Tạo 1 bảng dùng chung cho các trang nội dung tĩnh (page/CMS đơn giản):

```sql
CREATE TABLE store_pages (
  id            SERIAL PRIMARY KEY,
  slug          VARCHAR(50) UNIQUE NOT NULL,   -- vd: 'privacy-policy'
  title         VARCHAR(255) NOT NULL,         -- vd: 'Chính sách bảo mật'
  content       TEXT NOT NULL,                 -- HTML/Markdown do admin nhập
  content_type  VARCHAR(10) DEFAULT 'markdown',-- 'markdown' | 'html'
  is_published  BOOLEAN DEFAULT TRUE,
  updated_by    INT REFERENCES admin_users(id),
  updated_at    TIMESTAMP DEFAULT now(),
  created_at    TIMESTAMP DEFAULT now()
);
```

Seed 4 dòng mặc định:

| slug | title |
|---|---|
| `privacy-policy` | Chính sách bảo mật |
| `terms-of-service` | Điều khoản dịch vụ |
| `shipping-returns` | Giao hàng & trả hàng |
| `contact` | Liên hệ |

> Riêng trang **Liên hệ** có thể cần thêm bảng `contact_info` (hotline, email, địa chỉ, giờ làm việc, link mạng xã hội) thay vì chỉ 1 khối text — xem mục 5.

---

## 3. API

### Public (frontend shop gọi)
```
GET /api/pages/:slug
→ 200 { slug, title, content, content_type, updated_at }
→ 404 nếu chưa publish / không tồn tại
```

### Admin (yêu cầu auth admin)
```
GET    /api/admin/pages              -- danh sách 4 trang + trạng thái
GET    /api/admin/pages/:slug        -- lấy nội dung để sửa
PUT    /api/admin/pages/:slug        -- cập nhật title/content/is_published
```

Request body cho PUT:
```json
{
  "title": "Chính sách bảo mật",
  "content": "## Nội dung...",
  "content_type": "markdown",
  "is_published": true
}
```

---

## 4. Frontend (shop)

### Route
```
/chinh-sach-bao-mat      → slug: privacy-policy
/dieu-khoan-dich-vu      → slug: terms-of-service
/giao-hang-va-tra-hang   → slug: shipping-returns
/lien-he                 → slug: contact
```

### Component dùng chung: `StaticPage.tsx`
- Nhận `slug` từ route
- Gọi `GET /api/pages/:slug`
- Nếu `content_type = markdown` → render bằng thư viện markdown (vd `react-markdown`)
- Nếu `content_type = html` → render bằng `dangerouslySetInnerHTML` (đã sanitize ở backend/khi lưu, dùng `DOMPurify` ở FE nếu cần)
- Loading state / 404 state (trang chưa có nội dung)

→ Chỉ cần 1 component cho cả 3 trang chính sách/điều khoản/giao hàng, trang Liên hệ dùng component riêng vì có thêm form.

### Footer
Sửa link footer trỏ đúng route ở trên (hiện đang là placeholder không dẫn tới đâu).

---

## 5. Trang Liên hệ (khác 3 trang còn lại)

Trang Liên hệ nên gồm 2 phần:

1. **Nội dung mô tả** (lấy từ `store_pages` slug=`contact`, admin tự viết — vd lời chào, giờ làm việc...)
2. **Thông tin liên hệ có cấu trúc**, để hiển thị đẹp (icon điện thoại, email...) và dễ đồng bộ với footer/header nếu cần:

```sql
CREATE TABLE contact_info (
  id          SERIAL PRIMARY KEY,
  phone       VARCHAR(30),
  email       VARCHAR(255),
  address     TEXT,
  working_hours VARCHAR(255),
  facebook_url  VARCHAR(255),
  zalo_url      VARCHAR(255),
  updated_at    TIMESTAMP DEFAULT now()
);
```

- Admin sửa qua `GET/PUT /api/admin/contact-info`
- Frontend `GET /api/contact-info` (public)
- (Tuỳ chọn) Form liên hệ gửi email cho admin: `POST /api/contact/submit { name, email, message }` → gửi mail hoặc lưu vào bảng `contact_messages` để admin xem trong admin panel.

---

## 6. Admin UI

Menu admin thêm mục **"Trang nội dung"** với:

- Danh sách 4 trang (title, trạng thái publish, ngày sửa cuối)
- Bấm vào 1 trang → form sửa:
  - Ô tiêu đề
  - Trình soạn thảo nội dung (rich text editor, vd TipTap/Quill nếu dùng HTML, hoặc textarea + preview nếu dùng Markdown)
  - Toggle "Đã publish"
  - Nút Lưu → gọi `PUT /api/admin/pages/:slug`
- Với trang Liên hệ: thêm tab/khối riêng để sửa `contact_info` (số điện thoại, email, địa chỉ, giờ làm việc, link MXH)

---

## 7. Việc cần làm (checklist triển khai)

- [ ] Tạo bảng `store_pages`, seed 4 dòng mặc định (content rỗng hoặc placeholder)
- [ ] Tạo bảng `contact_info` (+ `contact_messages` nếu làm form liên hệ)
- [ ] API public `GET /api/pages/:slug`, `GET /api/contact-info`
- [ ] API admin CRUD cho `store_pages` và `contact_info`
- [ ] Component `StaticPage.tsx` render markdown/html
- [ ] Trang Liên hệ riêng (nội dung + thông tin liên hệ + form nếu cần)
- [ ] Nối 4 route vào router
- [ ] Sửa link footer trỏ đúng route
- [ ] Màn admin: menu "Trang nội dung" + editor + phần sửa thông tin liên hệ
- [ ] Admin nhập nội dung thật cho 4 trang trước khi lên production

---

## 8. Gợi ý thứ tự làm

1. Migration DB (mục 2, 5)
2. API backend (mục 3, 5)
3. Admin UI để nhập nội dung (mục 6) — làm trước để có data test
4. Frontend hiển thị (mục 4, 5) + sửa footer
5. QA: kiểm tra 404 khi chưa publish, kiểm tra render markdown/html an toàn (XSS)
