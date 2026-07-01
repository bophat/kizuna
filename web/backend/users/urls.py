from django.urls import path
from .views import (
    RegisterView,
    UserDetailView,
    UserListView,
    RoleListView,
    AssignRoleView,
    EmailTokenObtainPairView,
    CookieTokenRefreshView,
    LogoutView,
    CheckEmailView,
    UserAvatarUploadView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', EmailTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
    path('me/', UserDetailView.as_view(), name='user_me'),
    path('me/avatar/', UserAvatarUploadView.as_view(), name='user_avatar_upload'),
    path('users/', UserListView.as_view(), name='user_list'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user_detail'),
    path('roles/', RoleListView.as_view(), name='role_list'),
    path('users/<int:user_id>/assign-role/<int:role_id>/', AssignRoleView.as_view(), name='assign_role'),
    path('users/check-email/', CheckEmailView.as_view(), name='check_email'),
]
