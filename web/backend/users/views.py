import logging

from django.core import signing
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth.models import User
from django.db import transaction
from .models import Role
from .serializers import UserSerializer, RegisterSerializer, RoleSerializer, EmailTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .cookie_auth import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
from shop.models import UserProfile
from .email_verification import read_verification_token, send_verification_email
from .throttles import (
    LoginRateThrottle,
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
    def post(self, request, *args, **kwargs):
        refresh = request.COOKIES.get(REFRESH_COOKIE) or request.data.get('refresh')
        if not refresh:
            return Response({'detail': 'Refresh token missing'}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = self.get_serializer(data={'refresh': refresh})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken(exc.args[0]) from exc

        access = serializer.validated_data['access']
        response = Response({'detail': 'ok'})
        refresh_token = RefreshToken(refresh)
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
