import { apiFetch } from './api';

const ATTRIBUTION_KEY = 'kizuna_affiliate_attribution';
const SESSION_KEY = 'kizuna_affiliate_session_id';
const COOKIE_NAME = 'kizuna_affiliate';

type StoredAttribution = {
  code: string;
  expiresAt: number;
};

function sessionId() {
  let value = localStorage.getItem(SESSION_KEY);
  if (!value) {
    value = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(SESSION_KEY, value);
  }
  return value;
}

export function getAffiliateCode() {
  try {
    const stored = JSON.parse(localStorage.getItem(ATTRIBUTION_KEY) || '') as StoredAttribution;
    if (stored.code && stored.expiresAt > Date.now()) return stored.code;
    localStorage.removeItem(ATTRIBUTION_KEY);
  } catch {
    localStorage.removeItem(ATTRIBUTION_KEY);
  }
  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${COOKIE_NAME}=`));
  return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : '';
}

export async function captureAffiliateFromUrl(search: string, landingPath: string) {
  const code = new URLSearchParams(search).get('ref')?.trim().toUpperCase();
  if (!code || !/^[A-Z0-9_-]{2,40}$/.test(code)) return;
  try {
    const response = await apiFetch('/shop/affiliates/track/', {
      method: 'POST',
      body: JSON.stringify({
        code,
        session_id: sessionId(),
        landing_path: landingPath,
      }),
    });
    if (!response.ok) return;
    const data = await response.json();
    const cookieDays = Math.max(1, Math.min(365, Number(data.cookie_days) || 30));
    const maxAge = cookieDays * 24 * 60 * 60;
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify({
      code: data.code,
      expiresAt: Date.now() + maxAge * 1000,
    }));
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(data.code)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  } catch {
    // Referral tracking must never block browsing or checkout.
  }
}
