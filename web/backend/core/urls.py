from django.contrib import admin
from django.urls import path, include, re_path
from .views import healthz, media_file

urlpatterns = [
    path('healthz', healthz, name='healthz'),
    path('api/health/', healthz, name='api-health'),
    path('admin/', admin.site.urls),
    path('api/', include('users.urls')),
    path('api/shop/', include('shop.urls')),
    path('api/admin/', include('admin_api.urls')),
    re_path(r'^media/(?P<path>.*)$', media_file, name='media-file'),
]
