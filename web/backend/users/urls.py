from django.urls import path
from .views import RegisterView, UserDetailView, UserListView, RoleListView, AssignRoleView, EmailTokenObtainPairView, CheckEmailView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', EmailTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', UserDetailView.as_view(), name='user_me'),
    path('users/', UserListView.as_view(), name='user_list'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user_detail'),
    path('roles/', RoleListView.as_view(), name='role_list'),
    path('users/<int:user_id>/assign-role/<int:role_id>/', AssignRoleView.as_view(), name='assign_role'),
    path('users/check-email/', CheckEmailView.as_view(), name='check_email'),
]
