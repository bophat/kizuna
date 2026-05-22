/** Giá trong DB/API lưu theo USD */
export const FREE_SHIPPING_MIN_USD = 100;

export const FALLBACK_RATES = {
  usdToVnd: 25_000,
  usdToJpy: 150,
} as const;

export type ExchangeRates = {
  usdToVnd: number;
  usdToJpy: number;
};

export type ExchangeRatesApiResponse = {
  base: string;
  usd_to_vnd: number;
  usd_to_jpy: number;
  jpy_to_vnd: number;
  source: string;
  date: string | null;
  fetched_at: string;
  is_live: boolean;
};

export function mapExchangeRatesFromApi(data: ExchangeRatesApiResponse): ExchangeRates {
  return {
    usdToVnd: data.usd_to_vnd,
    usdToJpy: data.usd_to_jpy,
  };
}

type PriceLang = 'en' | 'vi' | 'ja';

function resolveLang(locale?: string): PriceLang {
  const code = (locale || 'en').split('-')[0];
  if (code === 'vi' || code === 'ja') return code;
  return 'en';
}

function toUsd(amount: number | string): number {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return Number.isFinite(n) ? n : 0;
}

function resolveRates(rates?: ExchangeRates): ExchangeRates {
  return rates ?? FALLBACK_RATES;
}

export function formatPrice(
  amountUsd: number | string,
  locale?: string,
  rates?: ExchangeRates
): string {
  const usd = toUsd(amountUsd);
  const lang = resolveLang(locale);
  const { usdToVnd, usdToJpy } = resolveRates(rates);

  switch (lang) {
    case 'vi':
      return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
      }).format(Math.round(usd * usdToVnd));
    case 'ja':
      return new Intl.NumberFormat('ja-JP', {
        style: 'currency',
        currency: 'JPY',
        maximumFractionDigits: 0,
      }).format(Math.round(usd * usdToJpy));
    default:
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(usd);
  }
}

export function formatPriceRangeLabel(
  minUsd: number,
  maxUsd: number | null,
  locale?: string,
  rates?: ExchangeRates
): string {
  const lang = resolveLang(locale);

  if (maxUsd === null) {
    if (lang === 'vi') return `Trên ${formatPrice(minUsd, locale, rates)}`;
    if (lang === 'ja') return `${formatPrice(minUsd, locale, rates)}以上`;
    return `Over ${formatPrice(minUsd, locale, rates)}`;
  }
  if (minUsd === 0 && maxUsd > 0) {
    if (lang === 'vi') return `Dưới ${formatPrice(maxUsd, locale, rates)}`;
    if (lang === 'ja') return `${formatPrice(maxUsd, locale, rates)}未満`;
    return `Under ${formatPrice(maxUsd, locale, rates)}`;
  }
  return `${formatPrice(minUsd, locale, rates)} – ${formatPrice(maxUsd, locale, rates)}`;
}

export const PRICE_RANGE_OPTIONS = [
  { value: '0-100', min: 0, max: 100 as number | null },
  { value: '100-300', min: 100, max: 300 },
  { value: '300-500', min: 300, max: 500 },
  { value: '500', min: 500, max: null },
] as const;

export function getPriceRangeLabel(
  value: string,
  locale?: string,
  rates?: ExchangeRates
): string {
  const opt = PRICE_RANGE_OPTIONS.find((o) => o.value === value);
  if (!opt) return value;
  return formatPriceRangeLabel(opt.min, opt.max, locale, rates);
}

/** Giá USD gốc (nhãn phụ khi hiển thị VND/JPY) */
export function formatUsdRaw(amountUsd: number | string): string {
  const usd = toUsd(amountUsd);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(usd);
}
