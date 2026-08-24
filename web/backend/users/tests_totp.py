"""Test vectors published in RFC 4226 (HOTP) and RFC 6238 (TOTP).

If this module ever drifts, these fail: the expected values come from the
specifications, not from our own implementation.
"""

import base64
import hashlib

from django.test import SimpleTestCase

from .totp import _hotp, totp_at, verify


# RFC 4226 Appendix D uses the ASCII secret "12345678901234567890".
RFC4226_SECRET = base64.b32encode(b'12345678901234567890').decode()
RFC4226_EXPECTED = [
    '755224', '287082', '359152', '969429', '338314',
    '254676', '287922', '162583', '399871', '520489',
]

# RFC 6238 Appendix B, SHA-1 rows.
RFC6238_SHA1 = [
    (59, '94287082'),
    (1111111109, '07081804'),
    (1111111111, '14050471'),
    (1234567890, '89005924'),
    (2000000000, '69279037'),
    (20000000000, '65353130'),
]


class HotpTests(SimpleTestCase):
    def test_rfc4226_counters(self):
        for counter, expected in enumerate(RFC4226_EXPECTED):
            self.assertEqual(_hotp(RFC4226_SECRET, counter), expected, f'counter {counter}')


class TotpTests(SimpleTestCase):
    def test_rfc6238_sha1_vectors(self):
        for timestamp, expected in RFC6238_SHA1:
            # The RFC prints 8 digits; we issue 6, so compare the last 6.
            self.assertEqual(
                totp_at(RFC4226_SECRET, timestamp, digits=8),
                expected,
                f'time {timestamp}',
            )

    def test_verify_accepts_current_step(self):
        code = totp_at(RFC4226_SECRET, 1111111111)
        self.assertTrue(verify(RFC4226_SECRET, code, for_time=1111111111))

    def test_verify_tolerates_one_step_of_clock_drift(self):
        code = totp_at(RFC4226_SECRET, 1111111111)
        self.assertTrue(verify(RFC4226_SECRET, code, for_time=1111111111 + 30))
        self.assertTrue(verify(RFC4226_SECRET, code, for_time=1111111111 - 30))

    def test_verify_rejects_codes_beyond_the_window(self):
        code = totp_at(RFC4226_SECRET, 1111111111)
        self.assertFalse(verify(RFC4226_SECRET, code, for_time=1111111111 + 300))

    def test_verify_rejects_malformed_input(self):
        for bad in ('', None, 'abcdef', '12345', '1234567'):
            self.assertFalse(verify(RFC4226_SECRET, bad, for_time=1111111111), repr(bad))
