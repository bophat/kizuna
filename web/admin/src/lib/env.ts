/** Biến Vite — khai báo trên Vercel (prefix VITE_) */

const trimSlash = (url: string) => url.replace(/\/+$/, '');

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000/api';

const defaultMediaBaseUrl = API_BASE_URL.endsWith('/api')
  ? API_BASE_URL.slice(0, -4)
  : 'http://127.0.0.1:8000';

export const MEDIA_BASE_URL =
  import.meta.env.VITE_MEDIA_BASE_URL?.trim() || defaultMediaBaseUrl;

export const CHAT_API_BASE_URL = trimSlash(
  import.meta.env.VITE_CHAT_API_BASE_URL?.trim() || 'http://127.0.0.1:8000/api'
);

export const APP_URL = import.meta.env.VITE_APP_URL?.trim() || '';
