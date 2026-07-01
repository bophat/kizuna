"""Load repost config from Django admin settings (fallback to .env)."""

import json
import os
import requests
from dotenv import load_dotenv

load_dotenv()

DJANGO_API_URL = os.getenv('DJANGO_API_URL', 'http://127.0.0.1:8000/api').rstrip('/')
BOT_TOKEN = os.getenv('CHATBOT_INTERNAL_TOKEN', '')


def _fetch_django_config() -> dict:
    if not BOT_TOKEN:
        return {}
    try:
        res = requests.get(
            f'{DJANGO_API_URL}/admin/bot/config/',
            headers={'X-Bot-Token': BOT_TOKEN},
            timeout=15,
        )
        if res.status_code == 200:
            return res.json()
    except Exception as exc:
        print(f'[newfeed] Django config: {exc}')
    return {}


_remote = _fetch_django_config()


class Config:
    PAGE_ID = _remote.get('facebook_page_id') or os.getenv('PAGE_ID')
    PAGE_ACCESS_TOKEN = _remote.get('facebook_page_access_token') or os.getenv('PAGE_ACCESS_TOKEN')

    _group_raw = _remote.get('facebook_group_ids') or os.getenv('GROUP_IDS', '')
    try:
        _parsed = json.loads(_group_raw) if _group_raw.strip().startswith('[') else None
    except json.JSONDecodeError:
        _parsed = None
    GROUP_IDS = _parsed or [gid.strip() for gid in _group_raw.split(',') if gid.strip()]

    POSTS_PER_DAY = int(_remote.get('repost_posts_per_day') or os.getenv('POSTS_PER_DAY', 20))
    DELAY_BETWEEN_POSTS = int(_remote.get('repost_delay_minutes') or os.getenv('DELAY_BETWEEN_POSTS', 15))
    REPOST_ENABLED = (_remote.get('repost_enabled') or os.getenv('REPOST_ENABLED', 'true')).lower() in ('1', 'true', 'yes')

    START_TIME = os.getenv('START_TIME', '08:00')
    END_TIME = os.getenv('END_TIME', '22:00')

    USER_DATA_DIR = os.getenv('USER_DATA_DIR', 'browser_data/user_profile')
    HISTORY_FILE = os.getenv('HISTORY_FILE', 'data/history.json')


config = Config()
