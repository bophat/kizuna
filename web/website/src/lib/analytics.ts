import { GA_MEASUREMENT_ID } from '@/lib/env';
import { hasAnalyticsConsent } from '@/lib/consent';

/**
 * Google Analytics 4 (gtag.js) — chuẩn bị sẵn, chưa kích hoạt.
 *
 * Hai điều kiện phải cùng đúng thì GA mới chạy:
 *   1. Có VITE_GA_MEASUREMENT_ID (dạng "G-XXXXXXXXXX", tạo tại analytics.google.com).
 *   2. Khách đã bấm đồng ý ở banner cookie (xem lib/consent.ts).
 * Thiếu một trong hai thì không script nào được nạp và không request nào gửi
 * tới Google.
 */

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

let initialized = false;

export function initGA(): void {
  if (initialized || !GA_MEASUREMENT_ID || typeof document === 'undefined') return;
  // Never load gtag.js before the visitor has opted in.
  if (!hasAnalyticsConsent()) return;
  initialized = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  };
  window.gtag('js', new Date());
  // send_page_view: false — đây là SPA (react-router), page_view được bắn thủ công
  // mỗi khi đổi route qua trackPageView(), tránh đếm trùng/đếm thiếu.
  window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });
}

export function trackPageView(path: string, title?: string): void {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined' || !window.gtag) return;
  if (!hasAnalyticsConsent()) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title,
    page_location: window.location.href,
  });
}

/** Dùng cho các event thương mại điện tử sau này: add_to_cart, purchase, view_item... */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined' || !window.gtag) return;
  if (!hasAnalyticsConsent()) return;
  window.gtag('event', name, params);
}
