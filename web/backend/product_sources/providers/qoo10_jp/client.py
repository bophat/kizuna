from __future__ import annotations

import os
import time
from collections.abc import Callable
from typing import Any

import httpx

from product_sources.exceptions import (
    ProductNotFoundError,
    ProviderConfigurationError,
    ProviderPermissionError,
    ProviderRateLimitError,
    ProviderTemporaryError,
)


QAPI_ITEM_URL = (
    'https://api.qoo10.jp/GMKT.INC.Front.QAPIService/'
    'ItemsLookup.qapi/GetItemDetailInfo'
)


class Qoo10ApiClient:
    """Qoo10 Japan QAPI client using a seller certification key."""

    def __init__(
        self,
        *,
        certification_key: str | None = None,
        http_client: httpx.Client | None = None,
        sleeper: Callable[[float], None] = time.sleep,
    ):
        self.certification_key = (
            certification_key
            if certification_key is not None
            else (
                os.environ.get('QOO10_CERTIFICATION_KEY')
                or os.environ.get('QOO10_SELLER_AUTH_KEY')
                or ''
            )
        ).strip()
        self.timeout_seconds = float(os.environ.get('SOURCE_PROVIDER_TIMEOUT_SECONDS', '10'))
        self.max_attempts = max(1, int(os.environ.get('SOURCE_PROVIDER_MAX_ATTEMPTS', '3')))
        self.http_client = http_client or httpx.Client(
            timeout=self.timeout_seconds,
            follow_redirects=False,
        )
        self.sleeper = sleeper

    def _request(self, **kwargs) -> httpx.Response:
        last_error: Exception | None = None
        for attempt in range(1, self.max_attempts + 1):
            try:
                response = self.http_client.post(
                    QAPI_ITEM_URL,
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
            'Không thể kết nối Qoo10 QAPI sau nhiều lần thử.',
            details={'provider': 'qoo10_jp'},
        ) from last_error

    @staticmethod
    def _raise_http_error(response: httpx.Response) -> None:
        details = {'status_code': response.status_code, 'operation': 'get_item'}
        if response.status_code in (400, 401):
            raise ProviderConfigurationError(
                'Qoo10 từ chối certification key hoặc request.',
                details=details,
            )
        if response.status_code == 403:
            raise ProviderPermissionError(
                'Certification key chưa có quyền gọi Qoo10 QAPI.',
                details=details,
            )
        if response.status_code == 404:
            raise ProductNotFoundError('Không tìm thấy sản phẩm Qoo10.', details=details)
        if response.status_code == 429:
            raise ProviderRateLimitError(
                'Qoo10 QAPI đang giới hạn tần suất. Vui lòng thử lại sau.',
                details=details,
            )
        if response.status_code >= 500:
            raise ProviderTemporaryError('Qoo10 QAPI tạm thời không khả dụng.', details=details)
        if response.status_code >= 400:
            raise ProviderTemporaryError('Qoo10 QAPI trả lỗi không mong đợi.', details=details)

    @staticmethod
    def _result_code(payload: dict[str, Any]) -> int | None:
        try:
            return int(payload.get('ResultCode'))
        except (TypeError, ValueError):
            return None

    @classmethod
    def _raise_qapi_error(cls, payload: dict[str, Any], *, item_code: str) -> None:
        result_code = cls._result_code(payload)
        if result_code == 0:
            return
        details = {
            'provider_code': result_code,
            'source_product_id': item_code,
        }
        if result_code in {-10000, -90004, -90005}:
            raise ProviderConfigurationError(
                'Certification key Qoo10 không hợp lệ hoặc đã hết hạn.',
                details=details,
            )
        if result_code in {-90002, -90003}:
            raise ProviderPermissionError(
                'Certification key không có quyền gọi GetItemDetailInfo.',
                details=details,
            )
        if result_code == -10001:
            raise ProductNotFoundError(
                'Không tìm thấy sản phẩm Qoo10 với ItemCode này.',
                details=details,
            )
        raise ProviderTemporaryError(
            'Qoo10 QAPI không thể trả thông tin sản phẩm.',
            details=details,
        )

    def get_item(self, item_code: str) -> dict[str, Any]:
        if not self.certification_key:
            raise ProviderConfigurationError(
                'Thiếu QOO10_CERTIFICATION_KEY.',
                details={'missing': ['QOO10_CERTIFICATION_KEY']},
            )
        response = self._request(
            headers={
                'Content-Type': 'application/json; charset=utf-8',
                'GiosisCertificationKey': self.certification_key,
                'QAPIVersion': '1.2',
            },
            json={
                'returnType': 'application/json',
                'ItemCode': item_code,
                'SellerCode': '',
            },
        )
        self._raise_http_error(response)
        try:
            payload = response.json()
        except ValueError as exc:
            raise ProviderTemporaryError(
                'Qoo10 trả dữ liệu không hợp lệ.',
                details={'status_code': response.status_code},
            ) from exc
        if not isinstance(payload, dict):
            raise ProviderTemporaryError('Qoo10 trả dữ liệu không hợp lệ.')
        self._raise_qapi_error(payload, item_code=item_code)

        result = payload.get('ResultObject')
        if isinstance(result, list):
            item = next((value for value in result if isinstance(value, dict)), None)
        elif isinstance(result, dict):
            item = result
        else:
            item = None
        if not item:
            raise ProductNotFoundError(
                'Qoo10 không trả dữ liệu sản phẩm.',
                details={'source_product_id': item_code},
            )
        return item
