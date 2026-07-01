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
    ConciergeLiveStatusView,
    ConciergeReplyView,
    ConciergeMessageView,
    ConciergeStreamView,
    PublicSettingsView,
    PublicMediaView,
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
    path('settings/', PublicSettingsView.as_view(), name='public-settings'),
    path('concierge/reply/', ConciergeReplyView.as_view(), name='concierge-reply'),
    path('concierge/live-status/', ConciergeLiveStatusView.as_view(), name='concierge-live-status'),
    path('concierge/message/', ConciergeMessageView.as_view(), name='concierge-message'),
    path('concierge/stream/<str:session_id>/', ConciergeStreamView.as_view(), name='concierge-stream'),
    path('media/<path:path>', PublicMediaView.as_view(), name='public-media'),
    path('me/', MeView.as_view(), name='me'),
    path('', include(router.urls)),
]
