# Deploy Django backend lên Google Cloud Run

Kiến trúc hiện tại:

```text
Website Vercel ─┐
                ├──> Django API trên Cloud Run ───> PostgreSQL Neon
Admin Vercel ───┘                 │
                                  ├──> Cloud Storage (ảnh upload)
                                  └──> Nhà cung cấp SMTP (email xác minh)
```

Chỉ thư mục `web/backend` được build và deploy lên Cloud Run. Website và Admin
tiếp tục chạy trên hai Vercel projects hiện có.

## Thông tin cần chuẩn bị

- Google Cloud Project ID đã liên kết Billing Account.
- Neon pooled `DATABASE_URL` đang sử dụng. Chỉ nhập URL này trong prompt ẩn của
  script hoặc Secret Manager; không ghi giá trị thật vào tài liệu hay Git.
- URL website Vercel, ví dụ `https://kizuna-teal.vercel.app/`.
- URL admin Vercel, ví dụ `https://kizuna-admin.vercel.app/login`.
- Tài khoản SMTP của nhà cung cấp email: host, port, username, password/API key
  và địa chỉ gửi. Nên xác thực domain gửi để email ít vào Spam.
- Google Cloud CLI đã đăng nhập bằng `gcloud auth login`.

Không đưa `DATABASE_URL`, Django secret, SMTP password/API key hoặc
service-account JSON vào Git.

## Deploy backend

Từ thư mục project chạy:

```bash
cd /Users/phattdt/Desktop/phat/myprj-AIv2/web
./deploy-cloud-run.sh YOUR_GCP_PROJECT_ID
```

Lần chạy đầu tiên, script sẽ hỏi:

1. URL website Vercel.
2. URL admin Vercel.
3. Neon `DATABASE_URL` ở chế độ nhập ẩn.
4. SMTP host, username, địa chỉ gửi và password/API key. Password được nhập ẩn.

Script tự động:

- bật các Google Cloud API cần thiết;
- tạo private Cloud Storage bucket cho media;
- tạo runtime service account;
- lưu Neon URL và Django secret trong Secret Manager;
- lưu SMTP password/API key trong Secret Manager;
- build `web/backend/Dockerfile` bằng Cloud Build;
- chạy Django migration và khởi động Gunicorn;
- cấu hình CORS/CSRF cho đúng hai Vercel domains;
- deploy mặc định tại `asia-southeast1`, gần Neon Singapore;
- giới hạn Cloud Run mặc định ở `min=0`, `max=3`.

Cũng có thể truyền URL Vercel trước:

```bash
WEBSITE_URL=https://YOUR-WEBSITE.vercel.app \
ADMIN_URL=https://YOUR-ADMIN.vercel.app \
./deploy-cloud-run.sh YOUR_GCP_PROJECT_ID
```

Để deploy đầy đủ cấu hình gửi email mà không phải nhập lại các giá trị công
khai, dùng lệnh dưới đây. Thay các giá trị bằng thông tin do nhà cung cấp SMTP
cấp; không ghi password vào chính câu lệnh hoặc commit lên Git:

```bash
cd /Users/phattdt/Desktop/phat/myprj-AIv2/web

IFS= read -r -s -p "SMTP password/API key: " EMAIL_HOST_PASSWORD
echo
export EMAIL_HOST_PASSWORD

EMAIL_HOST="smtp.example.com" \
EMAIL_PORT="587" \
EMAIL_HOST_USER="your-smtp-username" \
EMAIL_USE_TLS="True" \
EMAIL_USE_SSL="False" \
DEFAULT_FROM_EMAIL="KIZUNA <no-reply@your-domain.com>" \
WEBSITE_URL="https://kizuna-teal.vercel.app" \
ADMIN_URL="https://kizuna-admin.vercel.app" \
./deploy-cloud-run.sh YOUR_GCP_PROJECT_ID

unset EMAIL_HOST_PASSWORD
```

Với cổng TLS thông thường, đặt `EMAIL_USE_TLS=True` và
`EMAIL_USE_SSL=False`. Nếu nhà cung cấp yêu cầu SSL trực tiếp thì đảo hai giá
trị; không bật cả hai. Từ lần deploy sau, script có thể dùng lại password trong
Secret Manager nếu không export `EMAIL_HOST_PASSWORD`.

Mặc định `min=0` không tạo chi phí instance cố định nhưng request đầu sau thời
gian idle có thể bị cold start. Muốn ưu tiên tốc độ ổn định:

```bash
MIN_INSTANCES=1 \
WEBSITE_URL=https://YOUR-WEBSITE.vercel.app \
ADMIN_URL=https://YOUR-ADMIN.vercel.app \
./deploy-cloud-run.sh YOUR_GCP_PROJECT_ID
```

Có thể ghi đè thêm `REGION`, `MAX_INSTANCES`, `CLOUD_RUN_CPU`,
`CLOUD_RUN_MEMORY` và `CLOUD_RUN_CONCURRENCY` khi cần.

## Cập nhật Vercel sau khi backend deploy

Script sẽ in ra Cloud Run URL, ví dụ:

```text
https://kizuna-api-xxxxx-as.a.run.app
```

Trong cả hai Vercel projects, cập nhật:

```text
VITE_API_BASE_URL=https://kizuna-api-xxxxx-as.a.run.app/api
VITE_MEDIA_BASE_URL=https://kizuna-api-xxxxx-as.a.run.app
```

Sau đó chọn **Redeploy** cho Website và Admin. Không thêm dấu `/` ở cuối URL.

## Kiểm tra

```bash
export BACKEND_URL="https://YOUR-CLOUD-RUN-URL.run.app"

curl -fsS "$BACKEND_URL/healthz"
curl -fsS "$BACKEND_URL/api/shop/exchange-rates/"
```

Health check thành công:

```json
{"status": "ok"}
```

Mở website Vercel và kiểm tra:

- danh sách sản phẩm tải được;
- đăng nhập website hoạt động;
- đăng nhập Admin hoạt động;
- ảnh sản phẩm hiển thị;
- upload ảnh từ Admin thành công.
- đăng ký bằng một email mới nhận được email xác minh;
- chưa bấm link thì không đăng nhập được, bấm link xong thì đăng nhập được;
- nút gửi lại email xác minh hoạt động.

Có thể kiểm tra riêng API gửi lại email mà không làm lộ tài khoản có tồn tại
hay không:

```bash
curl -i -X POST "$BACKEND_URL/api/resend-verification/" \
  -H 'Content-Type: application/json' \
  -H 'Accept-Language: vi' \
  --data '{"email":"YOUR-TEST-EMAIL@example.com"}'
```

## Xem log

```bash
gcloud run services logs read kizuna-api \
  --project YOUR_GCP_PROJECT_ID \
  --region asia-southeast1 \
  --limit 100
```

## Deploy code mới

Chạy lại cùng lệnh:

```bash
cd /Users/phattdt/Desktop/phat/myprj-AIv2/web
./deploy-cloud-run.sh YOUR_GCP_PROJECT_ID
```

Script sẽ dùng lại Neon secret, Django secret, bucket và service account đã tạo.
Lần đầu chuyển từ `us-central1` sang `asia-southeast1`, Cloud Run sẽ tạo URL mới;
phải cập nhật `VITE_API_BASE_URL` và `VITE_MEDIA_BASE_URL` trên cả hai dự án
Vercel. Các lần deploy tiếp theo trong cùng region sẽ giữ nguyên URL.
