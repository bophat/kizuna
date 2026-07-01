import json
import logging
import time
from datetime import datetime
from .config import config
from .page_crawler import crawler
from .group_poster import poster

logger = logging.getLogger(__name__)

class Coordinator:
    def __init__(self):
        self.history_file = config.HISTORY_FILE

    def _load_history(self):
        try:
            with open(self.history_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {}

    def _save_history(self, history):
        with open(self.history_file, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=4, ensure_ascii=False)

    def is_within_time_window(self):
        now = datetime.now().strftime("%H:%M")
        return config.START_TIME <= now <= config.END_TIME

    def process_cycle(self):
        """Một chu kỳ quét và đăng bài."""
        if not getattr(config, 'REPOST_ENABLED', True):
            logger.info("Auto-repost disabled in admin settings. Skipping cycle.")
            return
        if not self.is_within_time_window():
            logger.info("Hiện tại không nằm trong khung giờ hoạt động. Bỏ qua chu kỳ này.")
            return

        logger.info("Bắt đầu chu kỳ quét bài từ Page...")
        raw_posts = crawler.fetch_latest_posts()
        if not raw_posts:
            logger.info("Không tìm thấy bài viết nào mới trên Page.")
            return

        history = self._load_history()
        posts_count_today = 0

        for post_data in raw_posts:
            if posts_count_today >= config.POSTS_PER_DAY:
                logger.info("Đã đạt giới hạn bài đăng trong ngày.")
                break

            content = crawler.parse_post_content(post_data)
            post_id = content['post_id']

            # Kiểm tra những group nào bài này chưa được đăng
            posted_groups = history.get(post_id, [])
            target_groups = [gid for gid in config.GROUP_IDS if gid not in posted_groups]

            if not target_groups:
                continue

            for group_id in target_groups:
                if posts_count_today >= config.POSTS_PER_DAY:
                    break

                logger.info(f"Đang đăng bài {post_id} vào Group {group_id}...")
                success = poster.post_to_group(group_id, content)

                if success:
                    # Cập nhật history
                    if post_id not in history:
                        history[post_id] = []
                    history[post_id].append(group_id)
                    self._save_history(history)
                    posts_count_today += 1

                    logger.info(f"Đã đăng {post_id} -> {group_id}. Tổng cộng hôm nay: {posts_count_today}")

                    # Nghỉ để tránh spam
                    time.sleep(config.DELAY_BETWEEN_POSTS * 60)
                else:
                    logger.error(f"Thất bại khi đăng {post_id} vào Group {group_id}. Chuyển sang group tiếp theo.")

        logger.info(f"Kết thúc chu kỳ. Tổng số bài đã đăng hôm nay: {posts_count_today}")

coordinator = Coordinator()
