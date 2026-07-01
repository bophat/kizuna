import requests
import logging
from .config import config

logger = logging.getLogger(__name__)

class PageCrawler:
    def __init__(self):
        self.base_url = "https://graph.facebook.com/v19.0"
        self.page_id = config.PAGE_ID
        self.token = config.PAGE_ACCESS_TOKEN

    def fetch_latest_posts(self, limit=10):
        """Quét các bài viết mới nhất từ Fanpage."""
        endpoint = f"{self.page_id}/feed"
        params = {
            "access_token": self.token,
            "limit": limit,
            "fields": "id,message,attachments{data{url,type}}"
        }

        try:
            response = requests.get(f"{self.base_url}/{endpoint}", params=params, timeout=20)
            response.raise_for_status()
            data = response.json()
            return data.get("data", [])
        except Exception as e:
            logger.error(f"Lỗi khi quét bài từ Page {self.page_id}: {e}")
            return []

    def parse_post_content(self, post):
        """Trích xuất text và link media từ một bài viết."""
        message = post.get("message", "")
        # Lấy link ảnh đầu tiên nếu có
        attachments = post.get("attachments", {}).get("data", [])
        media_url = attachments[0].get("url") if attachments else None

        return {
            "post_id": post.get("id"),
            "text": message,
            "media_url": media_url
        }

crawler = PageCrawler()
