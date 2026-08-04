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

  /** Giá bán chính luôn hiển thị bằng VND; USD chỉ là đơn vị nội bộ. */
  const formatValuation = useCallback(
    (amountUsd: number | string) => {
      const localized = format(amountUsd);
      return localized;
    },
    [format]
  );

  const formatValuationSub = useCallback(
    (amountUsd: number | string) => formatUsd(amountUsd),
    [formatUsd]
  );

  return { format, formatUsd, formatValuation, formatValuationSub, locale, rates };
}
