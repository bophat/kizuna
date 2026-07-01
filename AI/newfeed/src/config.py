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


def _parse_group_ids(raw: str) -> list:
    if not raw:
        return []
    try:
        if raw.strip().startswith('['):
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(g).strip() for g in parsed if str(g).strip()]
    except json.JSONDecodeError:
        pass
    return [g.strip() for g in raw.split(',') if g.strip()]


def _groups_from_social_integrations(integrations: list) -> list:
    ids = []
    for acc in integrations or []:
        if acc.get('platform') != 'facebook' or not acc.get('enabled', True):
            continue
        ids.extend(_parse_group_ids((acc.get('credentials') or {}).get('group_ids', '')))
    return ids


_remote = _fetch_django_config()
_social = _remote.get('social_integrations') or []
_fb_groups = _remote.get('facebook_group_ids_all') or _groups_from_social_integrations(_social)
if not _fb_groups:
    _fb_groups = _parse_group_ids(_remote.get('facebook_group_ids', '') or os.getenv('GROUP_IDS', ''))


class Config:
    PAGE_ID = _remote.get('facebook_page_id') or os.getenv('PAGE_ID')
    PAGE_ACCESS_TOKEN = _remote.get('facebook_page_access_token') or os.getenv('PAGE_ACCESS_TOKEN')
    GROUP_IDS = _fb_groups

    POSTS_PER_DAY = int(_remote.get('repost_posts_per_day') or os.getenv('POSTS_PER_DAY', 20))
    DELAY_BETWEEN_POSTS = int(_remote.get('repost_delay_minutes') or os.getenv('DELAY_BETWEEN_POSTS', 15))
    REPOST_ENABLED = (_remote.get('repost_enabled') or os.getenv('REPOST_ENABLED', 'true')).lower() in ('1', 'true', 'yes')

    START_TIME = os.getenv('START_TIME', '08:00')
    END_TIME = os.getenv('END_TIME', '22:00')

    USER_DATA_DIR = os.getenv('USER_DATA_DIR', 'browser_data/user_profile')
    HISTORY_FILE = os.getenv('HISTORY_FILE', 'data/history.json')
    SOCIAL_INTEGRATIONS = _social


config = Config()
