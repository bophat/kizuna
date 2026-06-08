import { useMemo, useState } from 'react';
import { Calculator, ArrowRight, RefreshCw } from 'lucide-react';
import { shopApiFetch, type ExchangeRatesResponse } from '../../lib/shopApi';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import {
  calculatePricing,
  formatVnd,
} from '../../features/pricing/calculatePricing';
import { useFormatPrice } from '../../hooks/useFormatPrice';
import {
  DEFAULT_PRICING_INPUTS,
  type PricingInputs,
  type OriginCurrency,
} from '../../features/pricing/types';

interface PricingCalculatorProps {
  onApplyPrice: (usdPrice: string) => void;
}

function NumField({
  label,
  hint,
  value,
  onChange,
  suffix = '₫',
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-[0.15em] text-brand-ink/40 font-bold block">
        {label}
      </label>
      {hint && <p className="text-[10px] text-brand-ink/30 italic">{hint}</p>}
      <div className="relative">
        <input
          type="number"
          min={0}
          step="any"
          value={value || ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full pr-10 px-3 py-2 bg-white border border-brand-clay rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-brand-ink/30">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export function PricingCalculator({ onApplyPrice }: PricingCalculatorProps) {
  const { t } = useTranslation();
  const { format: formatPrice, formatUsd } = useFormatPrice();
  const [inputs, setInputs] = useState<PricingInputs>(() => {
    try {
      const saved = localStorage.getItem('izuna_pricing_defaults');
      return saved ? { ...DEFAULT_PRICING_INPUTS, ...JSON.parse(saved) } : DEFAULT_PRICING_INPUTS;
    } catch {
      return DEFAULT_PRICING_INPUTS;
    }
  });

  const result = useMemo(() => calculatePricing(inputs), [inputs]);
  const [ratesSyncing, setRatesSyncing] = useState(false);
  const [ratesSyncedAt, setRatesSyncedAt] = useState<string | null>(null);

  const patch = (partial: Partial<PricingInputs>) =>
    setInputs((prev) => ({ ...prev, ...partial }));

  const currencySuffix = inputs.originCurrency === 'JPY' ? '¥' : '$';
  const rateSuffix = inputs.originCurrency === 'JPY' ? '₫/¥' : '₫/$';

  const fetchLiveRates = async () => {
    setRatesSyncing(true);
    try {
      const res = await shopApiFetch('/exchange-rates/?refresh=1');
      if (!res.ok) throw new Error('rates fetch failed');
      const data: ExchangeRatesResponse = await res.json();
      // Cập nhật tỷ giá theo loại tiền tệ đang chọn
      const newRate = inputs.originCurrency === 'JPY' ? data.jpy_to_vnd : data.usd_to_vnd;
      patch({
        exchangeRate: newRate,
        usdToVndRate: data.usd_to_vnd,
      });
      setRatesSyncedAt(data.date || new Date().toISOString().slice(0, 10));
    } catch (err) {
      console.error('Failed to sync live rates:', err);
      alert(t('pricing.rates_sync_failed'));
    } finally {
      setRatesSyncing(false);
    }
  };

  const saveRates = () => {
    localStorage.setItem(
      'izuna_pricing_defaults',
      JSON.stringify({
        originCurrency: inputs.originCurrency,
        exchangeRate: inputs.exchangeRate,
        usdToVndRate: inputs.usdToVndRate,
        profitMarginPercent: inputs.profitMarginPercent,
        taxJapanPercent: inputs.taxJapanPercent,
      })
    );
  };

  const handleCurrencyChange = (currency: OriginCurrency) => {
    // Khi đổi loại tiền, cập nhật tỷ giá mặc định phù hợp
    const defaultRate = currency === 'JPY' ? 170 : 25000;
    patch({
      originCurrency: currency,
      exchangeRate: defaultRate,
    });
  };

  const breakdownRows = [
    { label: t('pricing.cost.origin'), value: result.originVnd },
    { label: `${t('pricing.cost.tax_japan')} (${inputs.taxJapanPercent}%)`, value: result.taxJapanVnd },
    { label: t('pricing.cost.tax_vietnam'), value: result.taxVietnamVnd },
    { label: t('pricing.cost.ship_int'), value: result.shipInternationalVnd },
    { label: t('pricing.cost.ship_japan'), value: result.shipJapanLocalVnd },
    { label: t('pricing.cost.ship_vietnam'), value: result.shipVietnamLocalVnd },
    { label: t('pricing.cost.hidden'), value: result.hiddenCostVnd },
  ];

  return (
    <div className="border border-brand-clay rounded-sm bg-brand-paper/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-brand-clay bg-white flex items-center gap-2">
        <Calculator size={16} className="text-brand-red" />
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-ink">
            {t('pricing.title')}
          </p>
          <p className="text-[10px] text-brand-ink/50 font-serif italic">{t('pricing.subtitle')}</p>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-red">
            {t('pricing.section_costs')}
          </p>

          {/* Chọn loại tiền tệ + Giá gốc */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-[0.15em] text-brand-ink/40 font-bold block">
              {t('pricing.fields.currency')}
            </label>
            <div className="flex gap-2">
              {(['JPY', 'USD'] as OriginCurrency[]).map((cur) => (
                <button
                  key={cur}
                  type="button"
                  onClick={() => handleCurrencyChange(cur)}
                  className={cn(
                    'flex-1 px-3 py-2 text-xs font-bold rounded-sm border transition-all',
                    inputs.originCurrency === cur
                      ? 'bg-brand-red text-white border-brand-red'
                      : 'bg-white border-brand-clay text-brand-ink/60 hover:border-brand-ink'
                  )}
                >
                  {cur === 'JPY' ? '¥ JPY (Yên Nhật)' : '$ USD (Đô la Mỹ)'}
                </button>
              ))}
            </div>
          </div>

          <NumField
            label={t('pricing.fields.origin_cost')}
            hint={inputs.originCurrency === 'JPY' ? t('pricing.fields.origin_jpy_hint') : t('pricing.fields.origin_usd_hint')}
            value={inputs.originCost}
            onChange={(v) => patch({ originCost: v })}
            suffix={currencySuffix}
          />

          <NumField
            label={t('pricing.fields.exchange_rate')}
            value={inputs.exchangeRate}
            onChange={(v) => patch({ exchangeRate: v })}
            suffix={rateSuffix}
          />

          {/* Thuế Nhật - nhập % */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-[0.15em] text-brand-ink/40 font-bold block">
              {t('pricing.fields.tax_japan')}
            </label>
            <div className="flex flex-wrap gap-2">
              {[8, 10].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => patch({ taxJapanPercent: pct })}
                  className={cn(
                    'px-3 py-1.5 text-[10px] font-bold rounded-sm border transition-all',
                    inputs.taxJapanPercent === pct
                      ? 'bg-brand-red text-white border-brand-red'
                      : 'bg-white border-brand-clay text-brand-ink/60 hover:border-brand-ink'
                  )}
                >
                  {pct}%
                </button>
              ))}
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={inputs.taxJapanPercent || ''}
                  onChange={(e) => patch({ taxJapanPercent: parseFloat(e.target.value) || 0 })}
                  className="w-20 px-2 py-1.5 pr-6 border border-brand-clay rounded-sm text-sm text-center"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-brand-ink/30">
                  %
                </span>
              </div>
            </div>
          </div>

          <NumField
            label={t('pricing.fields.tax_vietnam')}
            value={inputs.taxVietnamVnd}
            onChange={(v) => patch({ taxVietnamVnd: v })}
          />

          <NumField
            label={t('pricing.fields.ship_int')}
            value={inputs.shipInternationalVnd}
            onChange={(v) => patch({ shipInternationalVnd: v })}
          />

          <div className="grid grid-cols-2 gap-3">
            <NumField
              label={t('pricing.fields.ship_japan')}
              value={inputs.shipJapanLocalVnd}
              onChange={(v) => patch({ shipJapanLocalVnd: v })}
            />
            <NumField
              label={t('pricing.fields.ship_vietnam')}
              value={inputs.shipVietnamLocalVnd}
              onChange={(v) => patch({ shipVietnamLocalVnd: v })}
            />
          </div>

          <NumField
            label={t('pricing.fields.hidden')}
            hint={t('pricing.fields.hidden_hint')}
            value={inputs.hiddenCostVnd}
            onChange={(v) => patch({ hiddenCostVnd: v })}
          />

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-[0.15em] text-brand-ink/40 font-bold">
              {t('pricing.fields.margin')}
            </label>
            <div className="flex flex-wrap gap-2">
              {[15, 20, 25, 30].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => patch({ profitMarginPercent: m })}
                  className={cn(
                    'px-3 py-1.5 text-[10px] font-bold rounded-sm border transition-all',
                    inputs.profitMarginPercent === m
                      ? 'bg-brand-red text-white border-brand-red'
                      : 'bg-white border-brand-clay text-brand-ink/60 hover:border-brand-ink'
                  )}
                >
                  {m}%
                </button>
              ))}
              <input
                type="number"
                min={0}
                step="1"
                value={inputs.profitMarginPercent}
                onChange={(e) => patch({ profitMarginPercent: parseFloat(e.target.value) || 0 })}
                className="w-16 px-2 py-1.5 border border-brand-clay rounded-sm text-sm text-center"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-red">
            {t('pricing.section_result')}
          </p>

          <div className="bg-white border border-brand-clay rounded-sm divide-y divide-brand-clay/60">
            {breakdownRows.map((row) => (
              <div key={row.label} className="flex justify-between px-4 py-2 text-sm">
                <span className="text-brand-ink/60">{row.label}</span>
                <span className="font-medium tabular-nums">{formatVnd(row.value)}</span>
              </div>
            ))}
            <div className="flex justify-between px-4 py-3 bg-brand-paper/50 font-bold">
              <span>{t('pricing.result.total_cost')}</span>
              <span className="text-brand-ink tabular-nums">{formatVnd(result.totalCostVnd)}</span>
            </div>
            <div className="flex justify-between px-4 py-2 text-sm">
              <span className="text-brand-ink/60">{t('pricing.result.break_even')}</span>
              <span className="tabular-nums">{formatVnd(result.breakEvenVnd)}</span>
            </div>
            <div className="flex justify-between px-4 py-3 bg-brand-red/5 font-bold text-brand-red">
              <span>{t('pricing.result.selling', { margin: result.profitMarginPercent })}</span>
              <span className="tabular-nums">{formatVnd(result.sellingPriceVnd)}</span>
            </div>
            <div className="flex justify-between px-4 py-2 text-sm text-emerald-700">
              <span>{t('pricing.result.profit')}</span>
              <span className="font-semibold tabular-nums">+{formatVnd(result.profitVnd)}</span>
            </div>
            <div className="flex justify-between items-end px-4 py-3 border-t border-brand-clay bg-brand-ink text-white">
              <span className="text-xs uppercase tracking-widest font-bold">
                {t('pricing.result.usd_price')}
              </span>
              <div className="text-right">
                <span className="font-serif font-bold text-lg tabular-nums block">
                  {formatPrice(result.sellingPriceUsd)}
                </span>
                <span className="text-[10px] opacity-70 tabular-nums">
                  {formatUsd(result.sellingPriceUsd)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                saveRates();
                onApplyPrice(result.sellingPriceUsd.toFixed(2));
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-brand-ink text-white py-3 rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-brand-red transition-colors"
            >
              {t('pricing.apply_price')}
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={saveRates}
              className="px-4 py-3 border border-brand-clay rounded-sm text-[10px] font-bold uppercase tracking-widest text-brand-ink/50 hover:border-brand-ink transition-colors"
            >
              {t('pricing.save_rates')}
            </button>
          </div>

          <button
            type="button"
            onClick={fetchLiveRates}
            disabled={ratesSyncing}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-brand-clay rounded-sm text-[10px] font-bold uppercase tracking-widest text-brand-ink/60 hover:border-brand-red hover:text-brand-red transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={ratesSyncing ? 'animate-spin' : ''} />
            {t('pricing.fetch_live_rates')}
          </button>
          {ratesSyncedAt && (
            <p className="text-[10px] text-brand-ink/40 text-center">
              {t('pricing.rates_synced', { date: ratesSyncedAt })}
            </p>
          )}

          <p className="text-[10px] text-brand-ink/40 italic leading-relaxed">
            {t('pricing.formula_note')}
          </p>
        </div>
      </div>
    </div>
  );
}
