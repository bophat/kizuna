import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { shopApiFetch } from '../lib/shopApi';
import {
  FALLBACK_RATES,
  mapExchangeRatesFromApi,
  type ExchangeRates,
  type ExchangeRatesApiResponse,
} from '@izuna/shared/lib/formatPrice';

type ExchangeRatesMeta = {
  loading: boolean;
  refresh: () => Promise<void>;
};

const ExchangeRatesContext = createContext<(ExchangeRates & ExchangeRatesMeta) | null>(null);

export function ExchangeRatesProvider({ children }: { children: ReactNode }) {
  const [rates, setRates] = useState<ExchangeRates>(FALLBACK_RATES);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (refresh = false) => {
    try {
      const res = await shopApiFetch(
        refresh ? '/exchange-rates/?refresh=1' : '/exchange-rates/'
      );
      if (!res.ok) throw new Error('Failed to load exchange rates');
      const data: ExchangeRatesApiResponse = await res.json();
      setRates(mapExchangeRatesFromApi(data));
    } catch (err) {
      console.warn('Admin: using fallback exchange rates', err);
      setRates(FALLBACK_RATES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo(
    () => ({
      ...rates,
      loading,
      refresh: () => load(true),
    }),
    [rates, loading, load]
  );

  return (
    <ExchangeRatesContext.Provider value={value}>{children}</ExchangeRatesContext.Provider>
  );
}

export function useExchangeRates() {
  const ctx = useContext(ExchangeRatesContext);
  if (!ctx) {
    throw new Error('useExchangeRates must be used within ExchangeRatesProvider');
  }
  return ctx;
}
