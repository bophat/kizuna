import logging
import time
import sys
from AI.newfeed.src.coordinator import coordinator

# Cấu hình logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("FB_Share_Bot")

def main():
    logger.info("=== Facebook Page-to-Group Auto Post Bot Started ===")

    while True:
        try:
            coordinator.process_cycle()
        except Exception as e:
            logger.exception(f"Lỗi nghiêm trọng trong vòng lặp chính: {e}")

        # Nghỉ 30 phút trước khi quét lại Page để tìm bài mới
        logger.info("Nghỉ 30 phút trước khi quét lại...")
        time.sleep(30 * 60)

if __name__ == "__main__":
    main()
