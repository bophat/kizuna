from urllib.parse import quote

from django.conf import settings
from storages.backends.gcloud import GoogleCloudStorage


class CloudRunMediaStorage(GoogleCloudStorage):
    """Keep the bucket private and serve media through the Django service."""

    def url(self, name, parameters=None):
        del parameters
        encoded_name = quote(str(name).lstrip('/'), safe='/')
        return f"{settings.MEDIA_URL.rstrip('/')}/{encoded_name}"
