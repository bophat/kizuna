from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any


SENSITIVE_KEY_PARTS = (
    'token',
    'secret',
    'password',
    'authorization',
    'cookie',
    'api_key',
    'auth_key',
)


def is_sensitive_key(key: object) -> bool:
    normalized = str(key).lower()
    return any(part in normalized for part in SENSITIVE_KEY_PARTS)


def redact_sensitive_data(value: Any) -> Any:
    """Return a JSON-safe shape with sensitive values removed recursively."""
    if isinstance(value, Mapping):
        return {
            str(key): '[REDACTED]' if is_sensitive_key(key) else redact_sensitive_data(item)
            for key, item in value.items()
        }
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [redact_sensitive_data(item) for item in value]
    return value
