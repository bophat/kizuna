from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth.models import User
from .models import Role
from .serializers import UserSerializer, RegisterSerializer, RoleSerializer, EmailTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from shop.models import UserProfile
from .throttles import LoginRateThrottle, RegisterRateThrottle

class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle]

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer
    throttle_classes = [RegisterRateThrottle]

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
