# Prompt & Specification: Facebook Fanpage-to-Group Auto Post Share Bot

## 1. Objective
Tôi muốn xây dựng một công cụ tự động hóa (Automation Bot) bằng Python. Bot này có nhiệm vụ: Quét (crawl) các bài viết mới nhất/sẵn có trên Fanpage của tôi, sau đó tự động đăng/chia sẻ các bài viết đó vào danh sách các Hội nhóm (Facebook Groups) mà tôi cấu hình, theo lịch trình và tần suất được chỉ định.

## 2. Core Workflow & Features

### A. Cấu hình (Settings)
Người dùng cấu hình các thông số sau trong file cài đặt (ví dụ: `config.json` hoặc `.env`):
*   `PAGE_ID`: ID của Fanpage nguồn cần lấy bài.
*   `GROUP_IDS`: Danh sách các ID hội nhóm Facebook nhận bài đăng (Dạng mảng/list).
*   `POSTS_PER_DAY`: Số lượng bài đăng tối đa trong một ngày sang các nhóm.
*   `DELAY_BETWEEN_POSTS`: Khoảng thời gian giãn cách giữa các bài đăng (tính bằng phút) để tránh bị Facebook quét spam.
*   `START_TIME` / `END_TIME`: Khung giờ vàng cho phép bot hoạt động.

### B. Luồng xử lý của AI (Logic)
1.  **Bước 1 (Quét bài):** Bot kết nối với Fanpage, quét và lấy danh sách các bài đăng sẵn có (gồm text, hình ảnh, video hoặc link bài viết).
2.  **Bước 2 (Kiểm tra trạng thái):** Kiểm tra file `history.json` để xem bài viết nào trên Page đã được đăng vào những Group nào rồi, tránh đăng trùng lặp bài cũ.
3.  **Bước 3 (Đăng bài/Share):** Tiến hành đăng nội dung và media lấy từ Page sang các Group được chỉ định dựa trên lịch trình (`POSTS_PER_DAY` và thời gian giãn cách).
4.  **Bước 4 (Ghi nhận):** Lưu ID bài viết đã xử lý vào lịch sử sau khi đăng thành công.

## 3. Tech Stack & Method
*   **Language:** Python.
*   **Phương thức kết nối:** Hãy đề xuất giải pháp tối ưu nhất cho tôi. Ưu tiên **Facebook Graph API** (nếu Token của tôi có đủ quyền cho cả Page và Group). Trường hợp API của Facebook quá nghiêm ngặt với Group, hãy cân nhắc giải pháp giả lập trình duyệt bằng **Selenium** hoặc **Playwright** (chạy chế độ headless) sử dụng Cookie/Profile để cào bài và đăng bài.
*   **State Management:** Dùng file `history.json` để quản lý những bài đã đăng.

## 4. Expected Output From Claude Max
Hãy đóng vai một kỹ sư phần mềm chuyên về Automation và cung cấp cho tôi:
1.  **Cấu trúc thư mục** dự án sạch sẽ, dễ hiểu.
2.  **File `requirements.txt`** đầy đủ thư viện cần cài đặt.
3.  **File `config.json` hoặc `.env.example`** chứa toàn bộ phần cài đặt như tôi đã yêu cầu ở mục 2A.
4.  **Mã nguồn Python hoàn chỉnh**, viết dưới dạng các hàm/class rõ ràng, có ghi chú (comment) tiếng Việt giải thích luồng đi để tôi dễ chỉnh sửa.
5.  **Hướng dẫn chi tiết** cách cấu hình (cách lấy ID Group, ID Page, cách cài Cookie hoặc Token) và cách bấm chạy (Start) hệ thống.

---
*Bắt đầu viết mã nguồn và hướng dẫn từng bước cho tôi.*