const DEFAULT_MEDIA_BASE = 'http://127.0.0.1:8000';

export function getMediaUrl(
  path: string | null | undefined,
  baseUrl: string = DEFAULT_MEDIA_BASE
) {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
