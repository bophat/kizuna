from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SettingViewSet, AdminProductViewSet, AdminOrderViewSet, AdminUserViewSet, AdminCategoryViewSet, DashboardStatsView, BulkImportProductsView
from .views_product_images import ProductImageViewSet
from .views_ai import (
    AiDiscoverView,
    BotConfigView,
    BotPendingReplyCreateView,
    BotProductsView,
    PendingReplyViewSet,
    RepostLogViewSet,
    TrendingProductLeadViewSet,
)

from .views_chat_proxy import (
    ChatNotificationsStreamView,
    ChatReplyProxyView,
    ChatSessionsProxyView,
    ChatSseTicketView,
    ChatStatusView,
)
from .views_notifications import AdminNotificationFeedView

router = DefaultRouter()
router.register(r'products', AdminProductViewSet)
router.register(r'orders', AdminOrderViewSet)
router.register(r'users', AdminUserViewSet)
router.register(r'categories', AdminCategoryViewSet)
router.register(r'settings', SettingViewSet)
router.register(r'product-images', ProductImageViewSet)
router.register(r'pending-replies', PendingReplyViewSet, basename='pending-replies')
router.register(r'trending-leads', TrendingProductLeadViewSet, basename='trending-leads')
router.register(r'repost-logs', RepostLogViewSet, basename='repost-logs')

urlpatterns = [
    path('products/import-csv/', BulkImportProductsView.as_view(), name='admin-import-csv'),
    path('ai/discover/', AiDiscoverView.as_view(), name='admin-ai-discover'),
    path('bot/products/', BotProductsView.as_view(), name='bot-products'),
    path('bot/config/', BotConfigView.as_view(), name='bot-config'),
    path('bot/pending-replies/', BotPendingReplyCreateView.as_view(), name='bot-pending-replies'),
    path('chat/status/', ChatStatusView.as_view(), name='admin-chat-status'),
    path('notifications/feed/', AdminNotificationFeedView.as_view(), name='admin-notifications-feed'),
    path('chat/sessions/', ChatSessionsProxyView.as_view(), name='admin-chat-sessions'),
    path('chat/sse-ticket/', ChatSseTicketView.as_view(), name='admin-chat-sse-ticket'),
    path('chat/notifications/stream/', ChatNotificationsStreamView.as_view(), name='admin-chat-notifications-stream'),
    path('chat/<str:session_id>/reply/', ChatReplyProxyView.as_view(), name='admin-chat-reply'),
    path('', include(router.urls)),
    path('stats/', DashboardStatsView.as_view(), name='admin-stats'),
]
