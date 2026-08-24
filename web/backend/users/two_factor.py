"""Views for enrolling in, verifying and removing the TOTP second factor."""

from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .cookie_auth import set_auth_cookies
from .models import TwoFactorSetting
from .totp import (
    PERIOD,
    generate_recovery_codes,
    generate_secret,
    hash_recovery_code,
    provisioning_uri,
    verify as verify_totp,
)


def consume_second_factor(setting, code):
    """Check a TOTP code or a recovery code, spending whichever matched.

    A TOTP code is refused if its 30-second step was already used, so capturing
    one in transit does not allow a replay while it is still nominally valid.
    """
    code = (code or '').strip()
    if not code:
        return False

    if verify_totp(setting.secret, code):
        step = int(timezone.now().timestamp()) // PERIOD
        if setting.last_used_step is not None and step <= setting.last_used_step:
            return False
        setting.last_used_step = step
        setting.save(update_fields=['last_used_step', 'updated_at'])
        return True

    hashed = hash_recovery_code(code)
    if hashed in setting.recovery_code_hashes:
        setting.recovery_code_hashes = [
            existing for existing in setting.recovery_code_hashes if existing != hashed
        ]
        setting.save(update_fields=['recovery_code_hashes', 'updated_at'])
        return True

    return False


class TwoFactorStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        setting = TwoFactorSetting.objects.filter(user=request.user).first()
        return Response({
            'enabled': bool(setting and setting.is_enabled),
            'pending_setup': bool(setting and not setting.is_enabled),
            'recovery_codes_remaining': len(setting.recovery_code_hashes) if setting else 0,
        })


class TwoFactorSetupView(APIView):
    """Start enrollment: issue a secret and the QR provisioning URI."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        setting, _ = TwoFactorSetting.objects.get_or_create(
            user=request.user, defaults={'secret': generate_secret()}
        )
        if setting.is_enabled:
            return Response(
                {'detail': 'Two-factor authentication is already enabled.',
                 'code': 'already_enabled'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Restarting setup issues a fresh secret, so an abandoned attempt that
        # someone may have photographed cannot be completed later.
        setting.secret = generate_secret()
        setting.save(update_fields=['secret', 'updated_at'])
        return Response({
            'secret': setting.secret,
            'otpauth_uri': provisioning_uri(
                setting.secret, request.user.email or request.user.username
            ),
        })


class TwoFactorConfirmView(APIView):
    """Finish enrollment by proving the authenticator app works."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'two_factor'

    def post(self, request):
        setting = TwoFactorSetting.objects.filter(user=request.user).first()
        if not setting:
            return Response(
                {'detail': 'Start setup first.', 'code': 'setup_required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if setting.is_enabled:
            return Response(
                {'detail': 'Two-factor authentication is already enabled.',
                 'code': 'already_enabled'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not verify_totp(setting.secret, request.data.get('code')):
            return Response(
                {'detail': 'That code is not valid. Check your authenticator app.',
                 'code': 'invalid_code'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        recovery_codes = generate_recovery_codes()
        setting.is_enabled = True
        setting.confirmed_at = timezone.now()
        setting.recovery_code_hashes = [hash_recovery_code(c) for c in recovery_codes]
        setting.save(update_fields=[
            'is_enabled', 'confirmed_at', 'recovery_code_hashes', 'updated_at',
        ])
        # The only time the plaintext recovery codes are ever returned.
        return Response({'enabled': True, 'recovery_codes': recovery_codes})


class TwoFactorDisableView(APIView):
    """Turn 2FA off. Requires the password, not just an active session."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'two_factor'

    def post(self, request):
        password = request.data.get('password') or ''
        if not request.user.check_password(password):
            return Response(
                {'detail': 'Password is incorrect.', 'code': 'invalid_password'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        TwoFactorSetting.objects.filter(user=request.user).delete()
        return Response({'enabled': False})


class TwoFactorLoginView(APIView):
    """Second step of signing in when the account has 2FA enabled.

    Takes the credentials again alongside the code rather than trusting a
    partially-authenticated token, so there is no intermediate state to steal.
    """

    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'two_factor'

    def post(self, request):
        email = (request.data.get('email') or '').strip()
        password = request.data.get('password') or ''
        code = request.data.get('code') or ''

        user = authenticate(request, username=email, password=password)
        if user is None or not user.is_active:
            return Response(
                {'detail': 'Invalid email or password.', 'code': 'invalid_credentials'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        setting = TwoFactorSetting.objects.filter(user=user, is_enabled=True).first()
        if not setting:
            return Response(
                {'detail': 'Two-factor authentication is not enabled for this account.',
                 'code': 'two_factor_not_enabled'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not consume_second_factor(setting, code):
            return Response(
                {'detail': 'That code is not valid or has already been used.',
                 'code': 'invalid_code'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        refresh = RefreshToken.for_user(user)
        response = Response({'detail': 'ok'})
        set_auth_cookies(response, str(refresh.access_token), str(refresh))
        return response
