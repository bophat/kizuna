import { getMediaUrl as sharedGetMediaUrl } from '@izuna/shared/lib/media';
import { API_BASE_URL, MEDIA_BASE_URL } from './env';

export { API_BASE_URL };

export function getMediaUrl(path: string | null | undefined) {
  return sharedGetMediaUrl(path, MEDIA_BASE_URL);
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const lang = localStorage.getItem('i18nextLng') || 'en';
  const headers = {
    'Content-Type': 'application/json',
    'Accept-Language': lang,
    ...(options.headers || {}),
  };

  const isAuthEndpoint =
    endpoint.includes('/login/') ||
    endpoint.includes('/register/') ||
    endpoint.includes('/check-email/');

  const token = localStorage.getItem('access_token');
  if (token && !isAuthEndpoint) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
