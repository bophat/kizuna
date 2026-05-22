import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useExchangeRates } from '@/context/ExchangeRatesContext';
import {
  formatPrice,
  formatPriceRangeLabel,
  getPriceRangeLabel,
  PRICE_RANGE_OPTIONS,
  type ExchangeRates,
} from '@/lib/formatPrice';

export function useFormatPrice() {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  const { usdToVnd, usdToJpy, loading, isLive, source, date, refresh } = useExchangeRates();

  const rates: ExchangeRates = useMemo(
    () => ({ usdToVnd, usdToJpy }),
    [usdToVnd, usdToJpy]
  );

  const format = useCallback(
    (amountUsd: number | string) => formatPrice(amountUsd, locale, rates),
    [locale, rates]
  );

  const formatRange = useCallback(
    (minUsd: number, maxUsd: number | null) =>
      formatPriceRangeLabel(minUsd, maxUsd, locale, rates),
    [locale, rates]
  );

  const getRangeLabel = useCallback(
    (value: string) => getPriceRangeLabel(value, locale, rates),
    [locale, rates]
  );

  const priceRangeOptions = useMemo(
    () =>
      PRICE_RANGE_OPTIONS.map((opt) => ({
        value: opt.value,
        label: formatPriceRangeLabel(opt.min, opt.max, locale, rates),
      })),
    [locale, rates]
  );

  return {
    format,
    formatRange,
    getRangeLabel,
    priceRangeOptions,
    locale,
    rates,
    ratesLoading: loading,
    ratesLive: isLive,
    ratesSource: source,
    ratesDate: date,
    refreshRates: refresh,
  };
}
