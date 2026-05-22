from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SettingViewSet, AdminProductViewSet, AdminOrderViewSet, AdminUserViewSet, AdminCategoryViewSet, DashboardStatsView
from .views_product_images import ProductImageViewSet

router = DefaultRouter()
router.register(r'products', AdminProductViewSet)
router.register(r'orders', AdminOrderViewSet)
router.register(r'users', AdminUserViewSet)
router.register(r'categories', AdminCategoryViewSet)
router.register(r'settings', SettingViewSet)
router.register(r'product-images', ProductImageViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('stats/', DashboardStatsView.as_view(), name='admin-stats'),
]