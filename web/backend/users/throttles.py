from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'


class RegisterRateThrottle(AnonRateThrottle):
    scope = 'register'


class VerifyEmailRateThrottle(AnonRateThrottle):
    scope = 'verify_email'


class ResendVerificationRateThrottle(AnonRateThrottle):
    scope = 'resend_verification'
