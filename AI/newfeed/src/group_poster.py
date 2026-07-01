import logging
from playwright.sync_api import sync_playwright
from .config import config

logger = logging.getLogger(__name__)

class GroupPoster:
    def __init__(self):
        self.user_data_dir = config.USER_DATA_DIR

    def post_to_group(self, group_id, content):
        """Đăng nội dung vào một Group cụ thể bằng Playwright."""
        with sync_playwright() as p:
            # Sử dụng persistent_context để lưu session/cookies
            context = p.chromium.launch_persistent_context(
                user_data_dir=self.user_data_dir,
                headless=True, # Đổi thành False nếu muốn xem bot chạy
                args=["--disable-notifications"]
            )
            page = context.new_page()

            try:
                # Điều hướng thẳng đến trang tạo bài viết của Group
                url = f"https://www.facebook.com/groups/{group_id}"
                page.goto(url, wait_until="networkidle")

                # Tìm ô nhập liệu (Facebook thường dùng role="textbox" cho ô đăng bài)
                # Lưu ý: Selector của FB thay đổi thường xuyên, đây là cách tiếp cận bền vững hơn
                page.click('div[role="button"]:has-text("Write something"), div[role="button"]:has-text("Tạo bài viết công khai")')

                # Đợi ô nhập hiện ra và nhập text
                page.wait_for_selector('div[role="textbox"]')
                page.fill('div[role="textbox"]', content['text'])

                # Nếu có media_url, có thể chèn link vào text hoặc dùng upload (ở đây ta chèn link cho đơn giản và an toàn)
                if content.get('media_url'):
                    page.fill('div[role="textbox"]', f"{content['text']}\\n\\n{content['media_url']}")

                # Bấm nút Đăng
                page.click('div[aria-label="Post"], div[aria-label="Đăng"]')

                # Đợi một chút để bài đăng được gửi đi
                page.wait_for_timeout(5000)

                logger.info(f"Đăng bài thành công vào Group {group_id}")
                return True

            except Exception as e:
                logger.error(f"Lỗi khi đăng vào Group {group_id}: {e}")
                return False
            finally:
                context.close()

poster = GroupPoster()
