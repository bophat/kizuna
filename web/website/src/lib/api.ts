import { getMediaUrl as sharedGetMediaUrl } from '@izuna/shared/lib/media';
import { API_BASE_URL, MEDIA_BASE_URL } from './env';

export { API_BASE_URL };

export function getMediaUrl(path: string | null | undefined) {
  return sharedGetMediaUrl(path, MEDIA_BASE_URL, API_BASE_URL);
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/token/refresh/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => res.ok)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const isAuthEndpoint =
    endpoint.includes('/login/') ||
    endpoint.includes('/register/') ||
    endpoint.includes('/logout/') ||
    endpoint.includes('/token/refresh/') ||
    endpoint.includes('/check-email/');

  const lang = localStorage.getItem('i18nextLng') || 'en';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept-Language': lang,
    ...(options.headers as Record<string, string>),
  };

  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const doFetch = () =>
    fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

  let response = await doFetch();
  if (response.status === 401 && !isAuthEndpoint) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await doFetch();
    }
  }

  return response;
}
