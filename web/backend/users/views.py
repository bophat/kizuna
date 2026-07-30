import logging

from django.core import signing
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from .models import Role
from .serializers import (
    EmailTokenObtainPairSerializer,
    RegisterSerializer,
    RoleSerializer,
    SetPasswordSerializer,
    UserSerializer,
)
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.utils import get_md5_hash_password

from .cookie_auth import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
from shop.models import UserProfile
from .email_verification import read_verification_token, send_verification_email
from .password_reset import get_password_reset_user, send_password_reset_email
from .throttles import (
    LoginRateThrottle,
    PasswordChangeRequestRateThrottle,
    PasswordResetConfirmRateThrottle,
    PasswordResetRequestRateThrottle,
    RegisterRateThrottle,
    ResendVerificationRateThrottle,
    VerifyEmailRateThrottle,
)


logger = logging.getLogger(__name__)

class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle]

    def post(self, request, *args, **kwargs):
        email = (request.data.get('email') or '').strip()
        password = request.data.get('password') or ''
        inactive_user = User.objects.filter(email__iexact=email, is_active=False).first()
        if inactive_user and inactive_user.check_password(password):
            return Response(
                {
                    'detail': 'Please verify your email address before signing in.',
                    'code': 'email_not_verified',
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            set_auth_cookies(response, response.data['access'], response.data['refresh'])
            response.data = {'detail': 'ok'}
        return response


class CookieTokenRefreshView(TokenRefreshView):
    @staticmethod
    def invalid_refresh_response(detail, code='token_not_valid'):
        response = Response(
            {'detail': detail, 'code': code},
            status=status.HTTP_401_UNAUTHORIZED,
        )
        clear_auth_cookies(response)
        return response

    def post(self, request, *args, **kwargs):
        refresh = request.COOKIES.get(REFRESH_COOKIE) or request.data.get('refresh')
        if not refresh:
            return self.invalid_refresh_response('Refresh token missing')

        try:
            refresh_token = RefreshToken(refresh)
        except TokenError:
            return self.invalid_refresh_response('Refresh token is invalid or expired')

        user_id = refresh_token.get(jwt_settings.USER_ID_CLAIM)
        user = User.objects.filter(
            **{jwt_settings.USER_ID_FIELD: user_id},
            is_active=True,
        ).first()
        if not user:
            return self.invalid_refresh_response('User not found', 'user_not_found')

        if (
            jwt_settings.CHECK_REVOKE_TOKEN
            and refresh_token.get(jwt_settings.REVOKE_TOKEN_CLAIM)
            != get_md5_hash_password(user.password)
        ):
            return self.invalid_refresh_response(
                'The password has changed. Please sign in again.',
                'password_changed',
            )

        serializer = self.get_serializer(data={'refresh': refresh})
        try:
            serializer.is_valid(raise_exception=True)
        except (InvalidToken, TokenError):
            return self.invalid_refresh_response('Refresh token is invalid or expired')

        access = serializer.validated_data['access']
        response = Response({'detail': 'ok'})
        set_auth_cookies(response, access, str(refresh_token))
        return response


class LogoutView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        response = Response({'detail': 'logged out'})
        clear_auth_cookies(response)
        return response

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer
    throttle_classes = [RegisterRateThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            with transaction.atomic():
                user = serializer.save()
                send_verification_email(user, getattr(request, 'LANGUAGE_CODE', 'en'))
        except Exception:
            logger.exception('Unable to deliver account verification email')
            return Response(
                {
                    'detail': 'We could not send the verification email. Please try again later.',
                    'code': 'verification_delivery_failed',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {
                'detail': 'Verification email sent. Please check your inbox.',
                'code': 'verification_email_sent',
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = [VerifyEmailRateThrottle]

    def post(self, request):
        token = (request.data.get('token') or '').strip()
        if not token or len(token) > 4096:
            return Response(
                {'detail': 'Verification token is required.', 'code': 'verification_invalid'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payload = read_verification_token(token)
        except signing.SignatureExpired:
            return Response(
                {'detail': 'This verification link has expired.', 'code': 'verification_expired'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except signing.BadSignature:
            return Response(
                {'detail': 'This verification link is invalid.', 'code': 'verification_invalid'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(
            pk=payload.get('user_id'),
            email__iexact=payload.get('email', ''),
        ).first()
        if not user:
            return Response(
                {'detail': 'This verification link is invalid.', 'code': 'verification_invalid'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.is_active:
            user.is_active = True
            user.save(update_fields=['is_active'])

        return Response(
            {'detail': 'Email verified successfully.', 'code': 'email_verified'},
            status=status.HTTP_200_OK,
        )


class ResendVerificationView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = [ResendVerificationRateThrottle]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return Response(
                {'detail': 'Email is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(email__iexact=email, is_active=False).first()
        if user:
            try:
                send_verification_email(user, getattr(request, 'LANGUAGE_CODE', 'en'))
            except Exception:
                logger.exception('Unable to resend account verification email')
                return Response(
                    {
                        'detail': 'We could not send the verification email. Please try again later.',
                        'code': 'verification_delivery_failed',
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

        return Response(
            {
                'detail': 'If an unverified account exists, a new verification email has been sent.',
                'code': 'verification_email_sent',
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetRequestView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = [PasswordResetRequestRateThrottle]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        try:
            validate_email(email)
        except ValidationError:
            return Response(
                {'detail': 'A valid email address is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user and user.has_usable_password():
            try:
                send_password_reset_email(user, getattr(request, 'LANGUAGE_CODE', 'en'))
            except Exception:
                # Keep the response generic so an SMTP outage cannot reveal
                # whether the requested email belongs to an account.
                logger.exception('Unable to deliver password reset email')

        return Response(
            {
                'detail': 'If an active account exists, a password reset email has been sent.',
                'code': 'password_reset_email_sent',
            },
            status=status.HTTP_200_OK,
        )


class PasswordChangeRequestView(APIView):
    permission_classes = (IsAuthenticated,)
    throttle_classes = [PasswordChangeRequestRateThrottle]

    def post(self, request):
        if not request.user.email:
            return Response(
                {
                    'detail': 'Add an email address to your account before changing your password.',
                    'code': 'password_email_missing',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            send_password_reset_email(
                request.user,
                getattr(request, 'LANGUAGE_CODE', 'en'),
            )
        except Exception:
            logger.exception('Unable to deliver password change email')
            return Response(
                {
                    'detail': 'We could not send the password change email. Please try again later.',
                    'code': 'password_reset_delivery_failed',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {
                'detail': 'A password change link has been sent to your email address.',
                'code': 'password_reset_email_sent',
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = [PasswordResetConfirmRateThrottle]

    def post(self, request):
        uid = (request.data.get('uid') or '').strip()
        token = (request.data.get('token') or '').strip()
        if not uid or not token or len(uid) > 256 or len(token) > 256:
            return Response(
                {
                    'detail': 'This password reset link is invalid or has expired.',
                    'code': 'password_reset_invalid',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = get_password_reset_user(uid, token)
        if not user:
            return Response(
                {
                    'detail': 'This password reset link is invalid or has expired.',
                    'code': 'password_reset_invalid',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = SetPasswordSerializer(data=request.data, context={'user': user})
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password'])

        response = Response(
            {
                'detail': 'Your password has been changed. Please sign in again.',
                'code': 'password_reset_complete',
            },
            status=status.HTTP_200_OK,
        )
        clear_auth_cookies(response)
        return response

class UserListView(generics.ListCreateAPIView):
    queryset = User.objects.all()
    permission_classes = (IsAdminUser,)

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return RegisterSerializer
        return UserSerializer

class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def get_permissions(self):
        if 'pk' in self.kwargs:
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def get_object(self):
        if 'pk' not in self.kwargs:
            return self.request.user
        return super().get_object()

class UserAvatarUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        if 'avatar' not in request.FILES:
            return Response(
                {'error': 'No avatar file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        avatar_file = request.FILES['avatar']

        allowed_types = ['image/jpeg', 'image/png', 'image/webp']
        if avatar_file.content_type not in allowed_types:
            return Response(
                {'error': 'Invalid file type. Only JPEG, PNG, WEBP allowed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        max_size = 2 * 1024 * 1024
        if avatar_file.size > max_size:
            return Response(
                {'error': 'File too large. Max 2MB'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        profile, created = UserProfile.objects.get_or_create(user=user)

        if profile.avatar:
            profile.avatar.delete(save=False)

        profile.avatar.save(avatar_file.name, avatar_file, save=True)

        serializer = UserSerializer(user, context={'request': request})
        return Response(serializer.data)

class RoleListView(generics.ListCreateAPIView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = (IsAdminUser,)

class AssignRoleView(APIView):
    permission_classes = (IsAdminUser,)

    def post(self, request, user_id, role_id):
        try:
            user = User.objects.get(pk=user_id)
            role = Role.objects.get(pk=role_id)
            role.users.add(user)
            return Response({"status": "role assigned"}, status=status.HTTP_200_OK)
        except (User.DoesNotExist, Role.DoesNotExist):
            return Response({"error": "User or Role not found"}, status=status.HTTP_404_NOT_FOUND)

class CheckEmailView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return Response({"error": "Email field is required"}, status=400)
        exists = User.objects.filter(email__iexact=email).exists()
        return Response({"available": not exists})
