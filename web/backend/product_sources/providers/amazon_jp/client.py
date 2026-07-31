from __future__ import annotations

import hashlib
import os
import time
from collections.abc import Callable
from typing import Any

import httpx
from django.core.cache import cache

from product_sources.exceptions import (
    ProductNotFoundError,
    ProviderConfigurationError,
    ProviderPermissionError,
    ProviderRateLimitError,
    ProviderTemporaryError,
)


CATALOG_URL = 'https://creatorsapi.amazon/catalog/v1/getItems'
TOKEN_ENDPOINTS = {
    '2.3': 'https://creatorsapi.auth.us-west-2.amazoncognito.com/oauth2/token',
    '3.3': 'https://api.amazon.co.jp/auth/o2/token',
}


class AmazonCreatorsApiClient:
    """Small synchronous client for Amazon Creators API (Japan marketplace)."""

    def __init__(
        self,
        *,
        credential_id: str | None = None,
        credential_secret: str | None = None,
        credential_version: str | None = None,
        partner_tag: str | None = None,
        http_client: httpx.Client | None = None,
        sleeper: Callable[[float], None] = time.sleep,
    ):
        self.credential_id = (
            credential_id
            if credential_id is not None
            else os.environ.get('AMAZON_CREATORS_CREDENTIAL_ID', '')
        ).strip()
        self.credential_secret = (
            credential_secret
            if credential_secret is not None
            else os.environ.get('AMAZON_CREATORS_CREDENTIAL_SECRET', '')
        ).strip()
        self.credential_version = (
            credential_version
            if credential_version is not None
            else os.environ.get('AMAZON_CREATORS_CREDENTIAL_VERSION', '3.3')
        ).strip()
        self.partner_tag = (
            partner_tag
            if partner_tag is not None
            else os.environ.get('AMAZON_JP_PARTNER_TAG', '')
        ).strip()
        self.timeout_seconds = float(os.environ.get('SOURCE_PROVIDER_TIMEOUT_SECONDS', '10'))
        self.max_attempts = max(1, int(os.environ.get('SOURCE_PROVIDER_MAX_ATTEMPTS', '3')))
        self.http_client = http_client or httpx.Client(
            timeout=self.timeout_seconds,
            follow_redirects=False,
        )
        self.sleeper = sleeper

    def has_any_credentials(self) -> bool:
        return any((
            self.credential_id,
            self.credential_secret,
            self.partner_tag,
        ))

    def is_configured(self) -> bool:
        return all((
            self.credential_id,
            self.credential_secret,
            self.partner_tag,
        )) and self.credential_version in TOKEN_ENDPOINTS

    def _validate_configuration(self) -> None:
        missing = [
            name
            for name, value in (
                ('AMAZON_CREATORS_CREDENTIAL_ID', self.credential_id),
                ('AMAZON_CREATORS_CREDENTIAL_SECRET', self.credential_secret),
                ('AMAZON_JP_PARTNER_TAG', self.partner_tag),
            )
            if not value
        ]
        if missing:
            old_credentials_present = bool(
                os.environ.get('AMAZON_JP_API_KEY')
                or os.environ.get('AMAZON_JP_API_SECRET')
            )
            suffix = (
                ' PA-API credential cũ không dùng được với Creators API.'
                if old_credentials_present
                else ''
            )
            raise ProviderConfigurationError(
                f'Thiếu cấu hình Amazon Creators API: {", ".join(missing)}.{suffix}',
                details={'missing': missing},
            )
        if self.credential_version not in TOKEN_ENDPOINTS:
            raise ProviderConfigurationError(
                'AMAZON_CREATORS_CREDENTIAL_VERSION phải là 2.3 hoặc 3.3.',
                details={'credential_version': self.credential_version},
            )

    def _token_cache_key(self) -> str:
        identity = f'{self.credential_version}:{self.credential_id}'.encode()
        digest = hashlib.sha256(identity).hexdigest()
        return f'product_sources:amazon_creators_token:{digest}'

    def _request(self, method: str, url: str, **kwargs) -> httpx.Response:
        last_error: Exception | None = None
        for attempt in range(1, self.max_attempts + 1):
            try:
                response = self.http_client.request(
                    method,
                    url,
                    timeout=self.timeout_seconds,
                    **kwargs,
                )
            except httpx.TransportError as exc:
                last_error = exc
                if attempt < self.max_attempts:
                    self.sleeper(0.25 * (2 ** (attempt - 1)))
                    continue
                break

            if response.status_code >= 500 and attempt < self.max_attempts:
                self.sleeper(0.25 * (2 ** (attempt - 1)))
                continue
            return response

        raise ProviderTemporaryError(
            'Không thể kết nối Amazon Creators API sau nhiều lần thử.',
            details={'provider': 'amazon_jp'},
        ) from last_error

    @staticmethod
    def _json_object(response: httpx.Response, *, operation: str) -> dict[str, Any]:
        try:
            payload = response.json()
        except ValueError as exc:
            raise ProviderTemporaryError(
                f'Amazon trả dữ liệu không hợp lệ khi {operation}.',
                details={'status_code': response.status_code},
            ) from exc
        if not isinstance(payload, dict):
            raise ProviderTemporaryError(
                f'Amazon trả dữ liệu không hợp lệ khi {operation}.',
                details={'status_code': response.status_code},
            )
        return payload

    @staticmethod
    def _raise_http_error(response: httpx.Response, *, operation: str) -> None:
        status_code = response.status_code
        details = {'status_code': status_code, 'operation': operation}
        if status_code in (400, 401):
            raise ProviderConfigurationError(
                'Amazon Creators API từ chối credential hoặc request.',
                details=details,
            )
        if status_code == 403:
            raise ProviderPermissionError(
                'Tài khoản Amazon chưa có quyền dùng Creators API cho Amazon JP.',
                details=details,
            )
        if status_code == 404:
            raise ProductNotFoundError('Không tìm thấy sản phẩm Amazon.', details=details)
        if status_code == 429:
            raise ProviderRateLimitError(
                'Amazon Creators API đang giới hạn tần suất. Vui lòng thử lại sau.',
                details=details,
            )
        if status_code >= 500:
            raise ProviderTemporaryError(
                'Amazon Creators API tạm thời không khả dụng.',
                details=details,
            )
        if status_code >= 400:
            raise ProviderTemporaryError(
                'Amazon Creators API trả lỗi không mong đợi.',
                details=details,
            )

    def _fetch_access_token(self) -> str:
        endpoint = TOKEN_ENDPOINTS[self.credential_version]
        if self.credential_version.startswith('2.'):
            response = self._request(
                'POST',
                endpoint,
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                data={
                    'grant_type': 'client_credentials',
                    'client_id': self.credential_id,
                    'client_secret': self.credential_secret,
                    'scope': 'creatorsapi/default',
                },
            )
        else:
            response = self._request(
                'POST',
                endpoint,
                headers={'Content-Type': 'application/json'},
                json={
                    'grant_type': 'client_credentials',
                    'client_id': self.credential_id,
                    'client_secret': self.credential_secret,
                    'scope': 'creatorsapi::default',
                },
            )

        self._raise_http_error(response, operation='fetch_token')
        payload = self._json_object(response, operation='fetch_token')
        access_token = payload.get('access_token')
        if not isinstance(access_token, str) or not access_token:
            raise ProviderConfigurationError(
                'Amazon không trả access token. Hãy kiểm tra credential Creators API.',
            )
        try:
            expires_in = max(60, int(payload.get('expires_in', 3600)))
        except (TypeError, ValueError):
            expires_in = 3600
        cache.set(
            self._token_cache_key(),
            access_token,
            timeout=max(30, expires_in - 60),
        )
        return access_token

    def _get_access_token(self) -> str:
        cached = cache.get(self._token_cache_key())
        if isinstance(cached, str) and cached:
            return cached
        return self._fetch_access_token()

    def get_item(self, asin: str) -> dict[str, Any]:
        self._validate_configuration()
        access_token = self._get_access_token()
        authorization = f'Bearer {access_token}'
        if self.credential_version.startswith('2.'):
            authorization += f', Version {self.credential_version}'

        response = self._request(
            'POST',
            CATALOG_URL,
            headers={
                'Authorization': authorization,
                'Content-Type': 'application/json',
                'x-marketplace': 'www.amazon.co.jp',
            },
            json={
                'itemIds': [asin],
                'itemIdType': 'ASIN',
                'languagesOfPreference': ['ja_JP'],
                'marketplace': 'www.amazon.co.jp',
                'partnerTag': self.partner_tag,
                'resources': [
                    'images.primary.large',
                    'images.variants.large',
                    'itemInfo.byLineInfo',
                    'itemInfo.classifications',
                    'itemInfo.externalIds',
                    'itemInfo.features',
                    'itemInfo.productInfo',
                    'itemInfo.title',
                    'offersV2.listings.availability',
                    'offersV2.listings.isBuyBoxWinner',
                    'offersV2.listings.merchantInfo',
                    'offersV2.listings.price',
                ],
            },
        )
        self._raise_http_error(response, operation='get_item')
        payload = self._json_object(response, operation='get_item')

        items_result = payload.get('itemsResult')
        items = items_result.get('items') if isinstance(items_result, dict) else None
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict) and item.get('asin') == asin:
                    return item

        errors = payload.get('errors')
        error_code = None
        if isinstance(errors, list) and errors and isinstance(errors[0], dict):
            error_code = errors[0].get('code')
        raise ProductNotFoundError(
            'Không tìm thấy hoặc không thể truy cập sản phẩm Amazon này.',
            details={'source_product_id': asin, 'provider_code': error_code},
        )
