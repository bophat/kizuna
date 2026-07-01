from rest_framework_simplejwt.authentication import JWTAuthentication

from .cookie_auth import ACCESS_COOKIE


class CookieJWTAuthentication(JWTAuthentication):
    """Read JWT from httpOnly cookie, then fall back to Authorization header."""

    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            return super().authenticate(request)

        raw_token = request.COOKIES.get(ACCESS_COOKIE)
        if not raw_token:
            return None

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token
