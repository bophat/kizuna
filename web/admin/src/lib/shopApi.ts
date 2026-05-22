import { API_BASE_URL } from './env';

/** Public shop API (không qua prefix /admin). */
export async function shopApiFetch(endpoint: string, options: RequestInit = {}) {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const base = API_BASE_URL.replace(/\/api\/?$/, '');
  const url = `${base}/api/shop${path}`;

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  });
}

export type ExchangeRatesResponse = {
  usd_to_vnd: number;
  usd_to_jpy: number;
  jpy_to_vnd: number;
  source: string;
  date: string | null;
  is_live: boolean;
};
