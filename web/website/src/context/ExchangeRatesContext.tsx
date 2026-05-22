import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch } from '@/lib/api';
import {
  FALLBACK_RATES,
  mapExchangeRatesFromApi,
  type ExchangeRates,
  type ExchangeRatesApiResponse,
} from '@/lib/formatPrice';

type ExchangeRatesMeta = {
  source: string;
  date: string | null;
  fetchedAt: string | null;
  isLive: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

const ExchangeRatesContext = createContext<ExchangeRates & ExchangeRatesMeta | null>(null);

export function ExchangeRatesProvider({ children }: { children: ReactNode }) {
  const [rates, setRates] = useState<ExchangeRates>(FALLBACK_RATES);
  const [meta, setMeta] = useState<Omit<ExchangeRatesMeta, 'loading' | 'refresh'>>({
    source: 'fallback',
    date: null,
    fetchedAt: null,
    isLive: false,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (refresh = false) => {
    try {
      const res = await apiFetch(
        refresh ? '/shop/exchange-rates/?refresh=1' : '/shop/exchange-rates/'
      );
      if (!res.ok) throw new Error('Failed to load exchange rates');
      const data: ExchangeRatesApiResponse = await res.json();
      setRates(mapExchangeRatesFromApi(data));
      setMeta({
        source: data.source,
        date: data.date,
        fetchedAt: data.fetched_at,
        isLive: data.is_live,
      });
    } catch (err) {
      console.warn('Using fallback exchange rates:', err);
      setRates(FALLBACK_RATES);
      setMeta({
        source: 'fallback',
        date: null,
        fetchedAt: null,
        isLive: false,
      });
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
      ...meta,
      loading,
      refresh: () => load(true),
    }),
    [rates, meta, loading, load]
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
