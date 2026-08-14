from django.urls import path
from product_sources.views import (
    PreviewImportView,
    ImportSourceProductView,
    BulkImportView,
    PreviewManualBulkView,
    ImportManualBulkView,
    SyncSourceProductView,
    BulkSyncSourcesView,
)

urlpatterns = [
    path('import-source/preview/', PreviewImportView.as_view(), name='import-source-preview'),
    path('import-source/', ImportSourceProductView.as_view(), name='import-source'),
    path('import-source/bulk/', BulkImportView.as_view(), name='import-source-bulk'),
    path('import-manual/preview/', PreviewManualBulkView.as_view(), name='import-manual-preview'),
    path('import-manual/bulk/', ImportManualBulkView.as_view(), name='import-manual-bulk'),
    path('sync-sources/', BulkSyncSourcesView.as_view(), name='sync-sources'),
    path('<str:product_id>/sync-source/', SyncSourceProductView.as_view(), name='sync-source-product'),
]
