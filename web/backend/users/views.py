from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth.models import User
from .models import Role
from .serializers import UserSerializer, RegisterSerializer, RoleSerializer, EmailTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer

class UserListView(generics.ListCreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = (IsAuthenticated,)

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return RegisterSerializer
        return UserSerializer

class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    permission_classes = (IsAuthenticated,)
    serializer_class = UserSerializer

    def get_object(self):
        if 'pk' not in self.kwargs:
            return self.request.user
        return super().get_object()

class RoleListView(generics.ListCreateAPIView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = (IsAuthenticated,)

class AssignRoleView(APIView):
    permission_classes = (IsAuthenticated,)

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
        email = request.data.get('email')
        if not email:
            return Response({"error": "Email field is required"}, status=400)
        
        exists = User.objects.filter(email__iexact=email).exists()
        return Response({
            "email": email,
            "is_registered": exists
        })
