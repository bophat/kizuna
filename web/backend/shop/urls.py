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
    PublicSettingsView,
    PublicMediaView,
)
from .concierge_views import (
    ConciergeHistoryView,
    ConciergeLiveStatusView,
    ConciergeReplyView,
    ConciergeMessageView,
    ConciergeStreamView,
)
from .coupon_views import CouponValidateView
from .affiliate_views import AffiliateDashboardView, AffiliateTrackView
from .payment_views import PublicPaymentMethodsView, PaymentProofUploadView
from .payment_webhooks import SepayWebhookView
from .loyalty_views import LoyaltyDashboardView

router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'orders', OrderHistoryViewSet, basename='order-history')
router.register(r'cart', CartViewSet, basename='cart')
router.register(r'checkout', CheckoutViewSet, basename='checkout')
router.register(r'favorites', FavoriteViewSet, basename='favorite')

urlpatterns = [
    path(
        'payments/webhooks/sepay/',
        SepayWebhookView.as_view(),
        name='sepay-payment-webhook',
    ),
    path('loyalty/', LoyaltyDashboardView.as_view(), name='loyalty-dashboard'),
    path('payment-methods/', PublicPaymentMethodsView.as_view(), name='payment-methods'),
    path('orders/<int:order_id>/payment-proof/', PaymentProofUploadView.as_view(), name='payment-proof'),
    path('affiliates/track/', AffiliateTrackView.as_view(), name='affiliate-track'),
    path('affiliates/me/', AffiliateDashboardView.as_view(), name='affiliate-dashboard'),
    path('coupons/validate/', CouponValidateView.as_view(), name='coupon-validate'),
    path('exchange-rates/', ExchangeRatesView.as_view(), name='exchange-rates'),
    path('settings/', PublicSettingsView.as_view(), name='public-settings'),
    path('concierge/reply/', ConciergeReplyView.as_view(), name='concierge-reply'),
    path('concierge/live-status/', ConciergeLiveStatusView.as_view(), name='concierge-live-status'),
    path('concierge/history/', ConciergeHistoryView.as_view(), name='concierge-history'),
    path('concierge/message/', ConciergeMessageView.as_view(), name='concierge-message'),
    path('concierge/stream/<str:session_id>/', ConciergeStreamView.as_view(), name='concierge-stream'),
    path('media/<path:path>', PublicMediaView.as_view(), name='public-media'),
    path('me/', MeView.as_view(), name='me'),
    path('', include(router.urls)),
]
