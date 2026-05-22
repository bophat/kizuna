import type { PricingBreakdown, PricingInputs } from './types';

function n(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function calculatePricing(inputs: PricingInputs): PricingBreakdown {
  const jpyConverted =
    n(inputs.originCostJpy) > 0 && n(inputs.jpyToVndRate) > 0
      ? inputs.originCostJpy * inputs.jpyToVndRate
      : 0;

  const originVnd = n(inputs.originCostVnd) + jpyConverted;
  const taxJapanVnd = n(inputs.taxJapanVnd);
  const taxVietnamVnd = n(inputs.taxVietnamVnd);
  const shipInternationalVnd = n(inputs.shipInternationalVnd);
  const shipJapanLocalVnd = n(inputs.shipJapanLocalVnd);
  const shipVietnamLocalVnd = n(inputs.shipVietnamLocalVnd);
  const hiddenCostVnd = n(inputs.hiddenCostVnd);
  const margin = n(inputs.profitMarginPercent);

  const totalCostVnd =
    originVnd +
    taxJapanVnd +
    taxVietnamVnd +
    shipInternationalVnd +
    shipJapanLocalVnd +
    shipVietnamLocalVnd +
    hiddenCostVnd;

  const sellingPriceVnd = totalCostVnd * (1 + margin / 100);
  const profitVnd = sellingPriceVnd - totalCostVnd;
  const usdRate = n(inputs.usdToVndRate) || 25000;
  const sellingPriceUsd = sellingPriceVnd / usdRate;

  return {
    originVnd,
    taxJapanVnd,
    taxVietnamVnd,
    shipInternationalVnd,
    shipJapanLocalVnd,
    shipVietnamLocalVnd,
    hiddenCostVnd,
    totalCostVnd,
    breakEvenVnd: totalCostVnd,
    sellingPriceVnd,
    profitVnd,
    sellingPriceUsd,
    profitMarginPercent: margin,
  };
}

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
