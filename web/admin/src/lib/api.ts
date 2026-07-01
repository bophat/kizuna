import { getMediaUrl as sharedGetMediaUrl } from '@izuna/shared/lib/media';
import { API_BASE_URL, MEDIA_BASE_URL } from './env';

export { API_BASE_URL };

export function getMediaUrl(path: string | null | undefined) {
  return sharedGetMediaUrl(path, MEDIA_BASE_URL, API_BASE_URL);
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  let path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (
    !path.startsWith('/admin') &&
    !path.startsWith('/login') &&
    !path.startsWith('/register') &&
    !path.startsWith('/me') &&
    !path.startsWith('/shop')
  ) {
    path = `/admin${path}`;
  }

  const url = `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  
  const lang = localStorage.getItem('i18nextLng') || 'en';
  headers['Accept-Language'] = lang;

  const token = localStorage.getItem('access_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
