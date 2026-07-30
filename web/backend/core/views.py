import mimetypes
from pathlib import PurePosixPath

from django.core.files.storage import default_storage
from django.http import FileResponse, Http404, JsonResponse


def healthz(request):
    return JsonResponse({'status': 'ok'})


def media_file(request, path):
    """Stream local or private-GCS media through the same public URL."""

    normalized = str(PurePosixPath(path.replace('\\', '/'))).lstrip('/')
    if not normalized or '..' in PurePosixPath(normalized).parts:
        raise Http404

    try:
        if not default_storage.exists(normalized):
            raise Http404
        media = default_storage.open(normalized, 'rb')
    except Http404:
        raise
    except (FileNotFoundError, OSError, ValueError):
        raise Http404 from None

    content_type, _ = mimetypes.guess_type(normalized)
    response = FileResponse(media, content_type=content_type or 'application/octet-stream')
    response['Cross-Origin-Resource-Policy'] = 'cross-origin'
    response['Cache-Control'] = 'public, max-age=86400'
    return response
