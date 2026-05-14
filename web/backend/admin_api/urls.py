from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AdminProductViewSet, AdminOrderViewSet, AdminUserViewSet,
    AdminCategoryViewSet, DashboardStatsView
)

router = DefaultRouter()
router.register(r'products', AdminProductViewSet)
router.register(r'orders', AdminOrderViewSet)
router.register(r'users', AdminUserViewSet)
router.register(r'categories', AdminCategoryViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('stats/', DashboardStatsView.as_view(), name='admin-stats'),
]
