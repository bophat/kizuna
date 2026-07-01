"""Encrypt sensitive settings at rest and mask values for the admin API."""

from __future__ import annotations

import base64
import hashlib
import json
import os
from functools import lru_cache

from django.conf import settings

MASK_PLACEHOLDER = '********'

SECRET_SETTING_KEYS = frozenset({
    'gemini_api_key',
    'serper_api_key',
    'chatbot_internal_token',
    'facebook_page_access_token',
})

PASSWORD_CREDENTIAL_KEYS = frozenset({
    'access_token',
    'api_key',
    'api_secret',
    'bearer_token',
    'secret_key',
    'channel_token',
    'channel_secret',
})


def is_secret_setting_key(key: str) -> bool:
    return key in SECRET_SETTING_KEYS or key == 'social_integrations'


def is_masked_submission(value: str | None) -> bool:
    if value is None:
        return True
    text = str(value).strip()
    if not text:
        return True
    return text.startswith(MASK_PLACEHOLDER)


def mask_secret(plaintext: str) -> str:
    if not plaintext:
        return ''
    if len(plaintext) <= 4:
        return MASK_PLACEHOLDER
    return f'{MASK_PLACEHOLDER}{plaintext[-4:]}'


@lru_cache(maxsize=1)
def _fernet():
    from cryptography.fernet import Fernet

    material = os.environ.get('SETTINGS_ENCRYPTION_KEY') or settings.SECRET_KEY
    digest = hashlib.sha256(material.encode('utf-8')).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_at_rest(plaintext: str) -> str:
    if not plaintext:
        return ''
    if plaintext.startswith('enc:'):
        return plaintext
    token = _fernet().encrypt(plaintext.encode('utf-8')).decode('utf-8')
    return f'enc:{token}'


def decrypt_at_rest(value: str) -> str:
    if not value:
        return ''
    if not value.startswith('enc:'):
        return value
    token = value[4:]
    return _fernet().decrypt(token.encode('utf-8')).decode('utf-8')


def mask_social_integrations_for_api(raw: str) -> str:
    accounts = _decrypt_social_integrations(raw)
    for account in accounts:
        creds = account.get('credentials') or {}
        for key, val in list(creds.items()):
            if key in PASSWORD_CREDENTIAL_KEYS and val:
                creds[key] = mask_secret(str(val))
        account['credentials'] = creds
    return json.dumps(accounts, ensure_ascii=False)


def _decrypt_social_integrations(raw: str) -> list:
    if not raw.strip():
        return []
    try:
        accounts = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(accounts, list):
        return []

    for account in accounts:
        creds = account.get('credentials') or {}
        for key, val in list(creds.items()):
            if val:
                creds[key] = decrypt_at_rest(str(val))
        account['credentials'] = creds
    return accounts


def merge_social_integrations_for_storage(new_raw: str, existing_raw: str) -> str:
    try:
        new_accounts = json.loads(new_raw or '[]')
    except json.JSONDecodeError:
        return existing_raw

    if not isinstance(new_accounts, list):
        return existing_raw

    existing_by_id = {a.get('id'): a for a in _decrypt_social_integrations(existing_raw)}
    for account in new_accounts:
        old = existing_by_id.get(account.get('id')) or {}
        old_creds = old.get('credentials') or {}
        creds = account.get('credentials') or {}
        for key, val in list(creds.items()):
            if key in PASSWORD_CREDENTIAL_KEYS and is_masked_submission(str(val)):
                creds[key] = old_creds.get(key, '')
            elif key in PASSWORD_CREDENTIAL_KEYS and val:
                creds[key] = str(val)
        for key, val in creds.items():
            if key in PASSWORD_CREDENTIAL_KEYS and val:
                creds[key] = encrypt_at_rest(str(val))
        account['credentials'] = creds
    return json.dumps(new_accounts, ensure_ascii=False)


def prepare_setting_for_storage(key: str, value: str, existing_value: str = '') -> str:
    if key == 'social_integrations':
        return merge_social_integrations_for_storage(value, existing_value)

    if key in SECRET_SETTING_KEYS:
        if is_masked_submission(value):
            return existing_value
        return encrypt_at_rest(value.strip())

    return value


def expose_setting_for_api(key: str, stored_value: str) -> str:
    if key == 'social_integrations':
        return mask_social_integrations_for_api(stored_value)
    if key in SECRET_SETTING_KEYS:
        return mask_secret(decrypt_at_rest(stored_value))
    return stored_value


def get_setting_plaintext(key: str, default: str = '') -> str:
    from .models import Setting

    try:
        stored = Setting.objects.get(key=key).value
    except Setting.DoesNotExist:
        return default

    if key == 'social_integrations':
        accounts = _decrypt_social_integrations(stored)
        return json.dumps(accounts, ensure_ascii=False)

    if key in SECRET_SETTING_KEYS:
        return decrypt_at_rest(stored)

    return stored
