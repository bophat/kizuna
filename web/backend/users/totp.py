"""RFC 6238 TOTP, implemented on the standard library.

Kept dependency-free deliberately: the algorithm is small, and the module is
covered by the published RFC 4226/6238 test vectors in tests_totp.py, which is
stronger evidence of correctness than pinning an unfamiliar package.
"""

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

DIGITS = 6
PERIOD = 30
# Accept the neighbouring steps so a slightly wrong device clock still works.
DEFAULT_WINDOW = 1


def generate_secret(length=20):
    """Return a base32 secret (160 bits by default, as RFC 4226 recommends)."""
    return base64.b32encode(secrets.token_bytes(length)).decode('ascii').rstrip('=')


def _hotp(secret_b32, counter, digits=DIGITS, digestmod=hashlib.sha1):
    # Re-pad: base32 decoding requires the padding that generate_secret strips.
    padding = '=' * (-len(secret_b32) % 8)
    key = base64.b32decode(secret_b32.upper() + padding, casefold=True)
    digest = hmac.new(key, struct.pack('>Q', counter), digestmod).digest()
    offset = digest[-1] & 0x0F
    code = struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(code % (10 ** digits)).zfill(digits)


def totp_at(secret_b32, for_time, digits=DIGITS, period=PERIOD, digestmod=hashlib.sha1):
    return _hotp(secret_b32, int(for_time) // period, digits, digestmod)


def verify(secret_b32, code, for_time=None, window=DEFAULT_WINDOW):
    """Constant-time check of `code` against the steps around `for_time`."""
    code = (code or '').strip().replace(' ', '')
    if not code.isdigit() or len(code) != DIGITS:
        return False
    now = int(for_time if for_time is not None else time.time())
    for drift in range(-window, window + 1):
        candidate = totp_at(secret_b32, now + drift * PERIOD)
        if hmac.compare_digest(candidate, code):
            return True
    return False


def provisioning_uri(secret_b32, account_name, issuer='KIZUNA'):
    """otpauth:// URI for Google Authenticator, Authy, 1Password etc."""
    label = quote(f'{issuer}:{account_name}', safe='')
    return (
        f'otpauth://totp/{label}?secret={secret_b32}'
        f'&issuer={quote(issuer, safe="")}&algorithm=SHA1'
        f'&digits={DIGITS}&period={PERIOD}'
    )


def generate_recovery_codes(count=10):
    """One-time codes for when the authenticator device is lost."""
    return [f'{secrets.token_hex(2)}-{secrets.token_hex(2)}-{secrets.token_hex(2)}'
            for _ in range(count)]


def hash_recovery_code(code):
    return hashlib.sha256(code.strip().lower().encode('utf-8')).hexdigest()
