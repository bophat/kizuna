import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPrice, formatUsdRaw } from '@izuna/shared/lib/formatPrice';
import { useExchangeRates } from '../context/ExchangeRatesContext';

export function useFormatPrice() {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  const { usdToVnd, usdToJpy } = useExchangeRates();

  const rates = useMemo(() => ({ usdToVnd, usdToJpy }), [usdToVnd, usdToJpy]);

  const format = useCallback(
    (amountUsd: number | string) => formatPrice(amountUsd, locale, rates),
    [locale, rates]
  );

  const formatUsd = useCallback((amountUsd: number | string) => formatUsdRaw(amountUsd), []);

  /** Hiển thị theo locale + ghi chú USD khi không phải en */
  const formatValuation = useCallback(
    (amountUsd: number | string) => {
      const localized = format(amountUsd);
      const code = locale.split('-')[0];
      if (code === 'en') return localized;
      return localized;
    },
    [format, locale]
  );

  const formatValuationSub = useCallback(
    (amountUsd: number | string) => {
      const code = locale.split('-')[0];
      if (code === 'en') return null;
      return formatUsd(amountUsd);
    },
    [formatUsd, locale]
  );

  return { format, formatUsd, formatValuation, formatValuationSub, locale, rates };
}
