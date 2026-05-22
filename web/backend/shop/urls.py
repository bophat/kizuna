from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CartViewSet,
    CheckoutViewSet,
    MeView,
    ProductViewSet,
    CategoryViewSet,
    OrderHistoryViewSet,
    FavoriteViewSet,
    ExchangeRatesView,
)

router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'orders', OrderHistoryViewSet, basename='order-history')
router.register(r'cart', CartViewSet, basename='cart')
router.register(r'checkout', CheckoutViewSet, basename='checkout')
router.register(r'favorites', FavoriteViewSet, basename='favorite')

urlpatterns = [
    path('exchange-rates/', ExchangeRatesView.as_view(), name='exchange-rates'),
    path('me/', MeView.as_view(), name='me'),
    path('', include(router.urls)),
]
