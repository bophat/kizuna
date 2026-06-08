import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calculator } from 'lucide-react';
import { PricingCalculator } from '../components/inventory/PricingCalculator';

export function Pricing() {
  const { t } = useTranslation();
  const [weight, setWeight] = useState<string>('');

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 pb-20">
      <div className="space-y-2">
        <h1 className="text-3xl font-serif font-bold text-brand-ink flex items-center gap-3">
          <Calculator className="text-brand-red" size={32} />
          {t('nav.pricing')}
        </h1>
        <p className="text-sm text-brand-ink/60">
          {t('pricing.standalone_desc', 'Công cụ tính toán giá thành, chi phí và giá bán dự kiến một cách nhanh chóng.')}
        </p>
      </div>

      <div className="bg-white p-6 rounded-sm shadow-sm border border-brand-clay space-y-6">
        <div className="w-full md:w-1/2 space-y-2">
          <label className="text-[10px] uppercase tracking-[0.2em] text-brand-ink/40 font-bold block">
            {t('pricing.fields.weight', 'Cân nặng')} (kg)
          </label>
          <div className="relative">
            <input
              type="number"
              min={0}
              step="any"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full px-4 py-3 pr-10 bg-white border border-brand-clay rounded-sm text-sm font-medium focus:outline-none focus:ring-4 focus:ring-brand-red/5 focus:border-brand-red transition-all"
              placeholder="0"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-ink/40 text-xs font-bold">kg</span>
          </div>
        </div>

        <PricingCalculator
          weight={parseFloat(weight) || 0}
          onApplyPrice={(usd) => {
             // In standalone mode, we can copy to clipboard
             navigator.clipboard.writeText(usd);
             alert(t('pricing.copied_to_clipboard', 'Đã copy giá USD vào bộ nhớ tạm: ') + usd);
          }}
        />
      </div>
    </div>
  );
}
