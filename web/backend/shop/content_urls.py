from django.urls import path

from .content_views import ContactInfoView, ContactSubmitView, StorePageDetailView


urlpatterns = [
    path('pages/<slug:slug>/', StorePageDetailView.as_view(), name='store-page-detail'),
    path('contact-info/', ContactInfoView.as_view(), name='contact-info'),
    path('contact/submit/', ContactSubmitView.as_view(), name='contact-submit'),
]
