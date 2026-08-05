from django.urls import path

from .views_marketing import MarketingUnsubscribeView


urlpatterns = [
    path('unsubscribe/', MarketingUnsubscribeView.as_view(), name='marketing-unsubscribe'),
]
