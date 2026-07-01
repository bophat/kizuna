const DEFAULT_MEDIA_BASE = 'http://127.0.0.1:8000';

function resolveApiBase(mediaBaseUrl: string, apiBaseUrl?: string): string {
  if (apiBaseUrl) return apiBaseUrl.replace(/\/+$/, '');
  if (mediaBaseUrl.endsWith('/api')) return mediaBaseUrl.replace(/\/+$/, '');
  return `${mediaBaseUrl.replace(/\/+$/, '')}/api`;
}

/** Strip leading /media/ or media/ prefix from stored paths. */
function mediaRelativePath(path: string): string | null {
  if (path.startsWith('/media/')) return path.slice('/media/'.length);
  if (path.startsWith('media/')) return path.slice('media/'.length);
  return null;
}

export function getMediaUrl(
  path: string | null | undefined,
  baseUrl: string = DEFAULT_MEDIA_BASE,
  apiBaseUrl?: string
) {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('data:')) return path;

  const rel = mediaRelativePath(path);
  if (rel) {
    const api = resolveApiBase(baseUrl, apiBaseUrl);
    return `${api}/shop/media/${rel}`;
  }

  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl.replace(/\/+$/, '')}${normalized}`;
}
