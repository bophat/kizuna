import hashlib
import re
from dataclasses import dataclass
from io import BytesIO
from urllib.parse import urljoin

import httpx
from django.conf import settings
from PIL import Image, UnidentifiedImageError

from product_sources.exceptions import ImageValidationError, SSRFBlockedError
from product_sources.services.compliance_service import (
    get_allowed_image_hosts,
    validate_external_url,
)


_ALLOWED_FORMATS = {
    'JPEG': ('image/jpeg', 'jpg'),
    'PNG': ('image/png', 'png'),
    'WEBP': ('image/webp', 'webp'),
}
_REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})


@dataclass(frozen=True)
class DownloadedImage:
    content: bytes
    filename: str
    content_type: str


class ImageDownloadService:
    """Download provider images without trusting redirects, headers, or filenames."""

    def __init__(self, *, client: httpx.Client | None = None):
        self._client = client

    def download(self, url: str, *, filename_stem: str) -> DownloadedImage:
        if not getattr(settings, 'SOURCE_IMPORT_IMAGE_DOWNLOAD_ENABLED', False):
            raise ImageValidationError(
                'Tải ảnh nguồn đang bị tắt theo chính sách. '
                'Chỉ bật khi bạn có quyền lưu và phân phối lại ảnh.',
                details={'setting': 'SOURCE_IMPORT_IMAGE_DOWNLOAD_ENABLED'},
            )

        max_bytes = max(
            1,
            int(getattr(settings, 'SOURCE_IMPORT_IMAGE_MAX_BYTES', 10 * 1024 * 1024)),
        )
        max_redirects = max(
            0,
            int(getattr(settings, 'SOURCE_IMPORT_IMAGE_MAX_REDIRECTS', 3)),
        )
        timeout_seconds = max(
            0.1,
            float(getattr(settings, 'SOURCE_IMPORT_IMAGE_TIMEOUT_SECONDS', 10)),
        )

        client = self._client or httpx.Client(
            timeout=httpx.Timeout(timeout_seconds),
            follow_redirects=False,
        )
        owns_client = self._client is None
        try:
            content, content_type = self._fetch(
                client,
                url,
                max_bytes=max_bytes,
                max_redirects=max_redirects,
            )
        finally:
            if owns_client:
                client.close()

        image_format = self._validate_content(content, content_type)
        expected_content_type, extension = _ALLOWED_FORMATS[image_format]
        safe_stem = re.sub(r'[^A-Za-z0-9_-]+', '-', filename_stem).strip('-_')
        safe_stem = safe_stem[:80] or 'source-image'
        digest = hashlib.sha256(content).hexdigest()[:12]

        return DownloadedImage(
            content=content,
            filename=f'{safe_stem}-{digest}.{extension}',
            content_type=expected_content_type,
        )

    def _fetch(
        self,
        client: httpx.Client,
        url: str,
        *,
        max_bytes: int,
        max_redirects: int,
    ) -> tuple[bytes, str]:
        current_url = url
        redirects = 0

        while True:
            self._validate_safe_url(current_url)
            try:
                with client.stream(
                    'GET',
                    current_url,
                    headers={
                        'Accept': 'image/avif,image/webp,image/png,image/jpeg',
                        'User-Agent': 'KizunaImageImporter/1.0',
                    },
                ) as response:
                    if response.status_code in _REDIRECT_STATUSES:
                        location = response.headers.get('location')
                        if not location:
                            raise ImageValidationError(
                                'Máy chủ ảnh trả redirect nhưng không có Location.',
                            )
                        if redirects >= max_redirects:
                            raise ImageValidationError(
                                'Ảnh vượt quá số lần redirect cho phép.',
                                details={'max_redirects': max_redirects},
                            )
                        current_url = urljoin(str(response.url), location)
                        redirects += 1
                        continue

                    if not 200 <= response.status_code < 300:
                        raise ImageValidationError(
                            'Không thể tải ảnh từ nhà cung cấp.',
                            details={'http_status': response.status_code},
                        )

                    content_type = response.headers.get('content-type', '')
                    content_type = content_type.split(';', 1)[0].strip().lower()
                    if content_type not in {value[0] for value in _ALLOWED_FORMATS.values()}:
                        raise ImageValidationError(
                            'Content-Type ảnh không được hỗ trợ.',
                            details={'content_type': content_type or None},
                        )

                    content_length = response.headers.get('content-length')
                    if content_length:
                        try:
                            declared_size = int(content_length)
                        except ValueError:
                            declared_size = None
                        if declared_size is not None and declared_size > max_bytes:
                            raise ImageValidationError(
                                'Ảnh vượt quá dung lượng cho phép.',
                                details={'max_bytes': max_bytes},
                            )

                    chunks: list[bytes] = []
                    received = 0
                    for chunk in response.iter_bytes():
                        received += len(chunk)
                        if received > max_bytes:
                            raise ImageValidationError(
                                'Ảnh vượt quá dung lượng cho phép.',
                                details={'max_bytes': max_bytes},
                            )
                        chunks.append(chunk)
                    if received == 0:
                        raise ImageValidationError('Dữ liệu ảnh rỗng.')
                    return b''.join(chunks), content_type
            except ImageValidationError:
                raise
            except httpx.HTTPError as exc:
                raise ImageValidationError(
                    'Không thể kết nối đến máy chủ ảnh.',
                    details={'error_type': type(exc).__name__},
                ) from exc

    @staticmethod
    def _validate_safe_url(url: str) -> None:
        try:
            validate_external_url(url, allowed_hosts=get_allowed_image_hosts())
        except SSRFBlockedError as exc:
            raise ImageValidationError(
                'URL ảnh không an toàn hoặc không nằm trong whitelist.',
                details=exc.details,
            ) from exc

    @staticmethod
    def _validate_content(content: bytes, content_type: str) -> str:
        max_pixels = max(
            1,
            int(getattr(settings, 'SOURCE_IMPORT_IMAGE_MAX_PIXELS', 40_000_000)),
        )
        try:
            with Image.open(BytesIO(content)) as image:
                image_format = (image.format or '').upper()
                width, height = image.size
                if width <= 0 or height <= 0 or width * height > max_pixels:
                    raise ImageValidationError(
                        'Kích thước pixel của ảnh không hợp lệ hoặc quá lớn.',
                        details={
                            'width': width,
                            'height': height,
                            'max_pixels': max_pixels,
                        },
                    )
                image.verify()
        except ImageValidationError:
            raise
        except (
            Image.DecompressionBombError,
            UnidentifiedImageError,
            OSError,
            SyntaxError,
        ) as exc:
            raise ImageValidationError(
                'Magic bytes hoặc cấu trúc file ảnh không hợp lệ.',
            ) from exc

        if image_format not in _ALLOWED_FORMATS:
            raise ImageValidationError(
                'Định dạng ảnh không được hỗ trợ.',
                details={'format': image_format or None},
            )
        detected_content_type, _ = _ALLOWED_FORMATS[image_format]
        if detected_content_type != content_type:
            raise ImageValidationError(
                'Content-Type không khớp với dữ liệu thực của ảnh.',
                details={
                    'declared_content_type': content_type,
                    'detected_content_type': detected_content_type,
                },
            )
        return image_format
