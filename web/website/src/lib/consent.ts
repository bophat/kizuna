/**
 * Cookie consent for analytics.
 *
 * Analytics must not run until the visitor opts in: GA sets its own cookies and
 * sends data to Google, which needs consent under GDPR and Vietnam's Decree
 * 13/2023. Only the strictly necessary cookies the site needs to work at all
 * (auth session, guest cart) run without asking.
 */

export type ConsentChoice = 'granted' | 'denied';

export const CONSENT_STORAGE_KEY = 'kizuna-cookie-consent';
/** Fired on the window so listeners can react without polling storage. */
export const CONSENT_EVENT = 'kizuna:consent-changed';

export function getStoredConsent(): ConsentChoice | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  return stored === 'granted' || stored === 'denied' ? stored : null;
}

export function setConsent(choice: ConsentChoice): void {
  window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: choice }));
}

export function hasAnalyticsConsent(): boolean {
  return getStoredConsent() === 'granted';
}
