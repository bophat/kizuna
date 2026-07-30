from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle, UserRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'


class RegisterRateThrottle(AnonRateThrottle):
    scope = 'register'


class VerifyEmailRateThrottle(AnonRateThrottle):
    scope = 'verify_email'


class ResendVerificationRateThrottle(AnonRateThrottle):
    scope = 'resend_verification'


class PasswordResetIPRateThrottle(SimpleRateThrottle):
    def get_cache_key(self, request, view):
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request),
        }


class PasswordResetRequestRateThrottle(PasswordResetIPRateThrottle):
    scope = 'password_reset_request'


class PasswordResetConfirmRateThrottle(PasswordResetIPRateThrottle):
    scope = 'password_reset_confirm'


class PasswordChangeRequestRateThrottle(UserRateThrottle):
    scope = 'password_change_request'
