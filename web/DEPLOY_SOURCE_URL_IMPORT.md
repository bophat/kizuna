# Deploy chức năng nhập sản phẩm tự động từ URL

Chức năng ưu tiên API được cấp quyền:

- Amazon Japan: Amazon Creators API `GetItems`.
- Qoo10 Japan: QAPI `ItemsLookup.GetItemDetailInfo` v1.2.

Khi chưa có key, backend tự đọc metadata/HTML công khai của URL sản phẩm để lấy
tên, giá, ảnh, mô tả và tình trạng hàng. Luồng này không đăng nhập, không dùng
cookie trình duyệt và không vượt CAPTCHA/anti-bot.

## 1. Chuẩn bị credential

### Không có credential Amazon/Qoo10

Không cần cấu hình provider secret. Trong Admin → Kho hàng, chọn **Nhập từ URL**,
dán URL rồi bấm **Preview sản phẩm**. Backend tự lấy thông tin công khai và dùng
chung công thức giá của hệ thống.

Amazon công khai thường trả đủ dữ liệu. Qoo10 có thể chặn IP máy chủ hoặc trả lỗi
523; trường hợp đó hệ thống báo rõ URL bị chặn. **Nhập thủ công** chỉ còn là
phương án dự phòng cho URL bị marketplace chặn, không phải luồng chính.

### Chỉ dùng Qoo10

Lấy seller certification key từ tài khoản Qoo10/QSM đã được cấp quyền QAPI.
Backend chỉ cần một giá trị:

```text
QOO10_CERTIFICATION_KEY
```

### Chỉ dùng Amazon Japan

Đăng ký Amazon Associates và Creators API, sau đó tạo credential. Backend cần:

```text
AMAZON_CREATORS_CREDENTIAL_ID
AMAZON_CREATORS_CREDENTIAL_SECRET
AMAZON_CREATORS_CREDENTIAL_VERSION
AMAZON_JP_PARTNER_TAG
```

`AMAZON_CREATORS_CREDENTIAL_VERSION` phải là `2.3` hoặc `3.3`. Credential PA-API
cũ (`Access Key`/`Secret Key`) không dùng được.

## 2. Deploy từ Google Cloud Shell

Không dán credential trực tiếp vào câu lệnh vì nó sẽ nằm trong shell history.

```bash
cd ~/kizuna/web
git pull
```

Nếu cấu hình Qoo10, nhập key ẩn:

```bash
IFS= read -r -s -p "Qoo10 certification key: " QOO10_CERTIFICATION_KEY
echo
export QOO10_CERTIFICATION_KEY
```

Nếu cấu hình Amazon, nhập credential ẩn:

```bash
IFS= read -r -s -p "Amazon Creators credential ID: " AMAZON_CREATORS_CREDENTIAL_ID
echo
IFS= read -r -s -p "Amazon Creators credential secret: " AMAZON_CREATORS_CREDENTIAL_SECRET
echo
IFS= read -r -s -p "Amazon JP partner tag: " AMAZON_JP_PARTNER_TAG
echo

export AMAZON_CREATORS_CREDENTIAL_ID
export AMAZON_CREATORS_CREDENTIAL_SECRET
export AMAZON_JP_PARTNER_TAG
export AMAZON_CREATORS_CREDENTIAL_VERSION=3.3
```

Deploy backend:

```bash
WEBSITE_URL="https://kizuna-teal.vercel.app" \
ADMIN_URL="https://kizuna-admin.vercel.app" \
EMAIL_HOST="smtp.gmail.com" \
EMAIL_HOST_USER="bophat9420@gmail.com" \
DEFAULT_FROM_EMAIL="KIZUNA <bophat9420@gmail.com>" \
SOURCE_IMPORT_IMAGE_DOWNLOAD_ENABLED=true \
SOURCE_IMPORT_PUBLIC_PAGE_FALLBACK_ENABLED=true \
./deploy-cloud-run.sh kizuna-shop-503909
```

Script tự tạo/cập nhật Secret Manager và gắn các secret vào Cloud Run. Sau khi
deploy xong, xóa credential khỏi phiên shell:

```bash
unset QOO10_CERTIFICATION_KEY
unset AMAZON_CREATORS_CREDENTIAL_ID
unset AMAZON_CREATORS_CREDENTIAL_SECRET
unset AMAZON_JP_PARTNER_TAG
```

Các lần deploy sau không cần nhập lại provider credential; script sẽ tái sử dụng
secret hiện có.

## 3. Deploy Admin lên Vercel

Commit và push code, sau đó để Vercel build lại project admin. Biến môi trường
admin vẫn là:

```text
VITE_API_BASE_URL=https://kizuna-backend-857138195082.asia-southeast1.run.app/api
VITE_MEDIA_BASE_URL=https://kizuna-backend-857138195082.asia-southeast1.run.app
```

## 4. Sử dụng

1. Đăng nhập trang Admin.
2. Mở **Kho hàng**.
3. Chọn **Nhập từ URL**.
4. Dán một hoặc nhiều URL Amazon Japan/Qoo10 Japan, mỗi URL một dòng, rồi chọn
   **Thêm URL**. Có thể thêm tối đa 50 URL trong một lần.
5. Chọn danh mục, cân nặng mặc định, tồn kho và cách xử lý ảnh.
6. Chọn **Preview sản phẩm**. Tool sẽ tải tối đa 3 URL đồng thời và hiển thị
   tiến độ.
7. Kiểm tra thẻ sản phẩm và phần chi tiết mô phỏng website: ảnh, tên, danh mục,
   mô tả, tồn kho và giá theo ngôn ngữ hiện tại.
8. Bỏ chọn sản phẩm không muốn nhập. URL trùng hoặc preview lỗi sẽ không được
   chọn để nhập.
9. Chọn **Nhập sản phẩm đã chọn** và xem kết quả từng URL.

Các bước trên dùng được cả khi không có API key. Nếu có key hợp lệ, backend tự
ưu tiên API; nếu hoàn toàn không có key, backend tự dùng trang công khai.

Sản phẩm mới luôn được tạo ở trạng thái `draft`; cần kiểm tra trước khi publish.
Nếu đổi danh mục, cân nặng, tồn kho hoặc cách xử lý ảnh, preview cũ sẽ bị xóa và
phải chạy lại để kết quả hiển thị luôn khớp với thiết lập đang chọn.

## 5. Lỗi cấu hình thường gặp

- `Thiếu QOO10_CERTIFICATION_KEY`: chỉ xuất hiện khi fallback trang công khai đã
  bị tắt; bật lại fallback hoặc gắn secret Qoo10.
- `Certification key ... không hợp lệ hoặc đã hết hạn`: cấp lại key trong Qoo10.
- `Thiếu cấu hình Amazon Creators API`: credential Amazon đang được cấu hình dở;
  hoàn thiện đủ ba secret hoặc xóa cấu hình dở để dùng fallback công khai.
- `Tài khoản Amazon chưa có quyền`: tài khoản Associates/Creators API chưa được
  duyệt cho marketplace Nhật.
- `Marketplace đang chặn ... CAPTCHA`: trang công khai không cho Cloud Run đọc;
  thử lại sau, dùng API key khi có, hoặc dùng **Nhập thủ công** cho riêng URL đó.
- `Không đọc được tên sản phẩm`: cấu trúc trang đã thay đổi hoặc URL không phải
  trang chi tiết sản phẩm.
- `Tải ảnh nguồn đang bị tắt`: chọn `Dùng URL ảnh nguồn`, hoặc deploy lại với
  `SOURCE_IMPORT_IMAGE_DOWNLOAD_ENABLED=true` khi có quyền lưu/phân phối ảnh.
