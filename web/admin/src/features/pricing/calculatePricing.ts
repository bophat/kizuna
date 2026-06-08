import type { PricingBreakdown, PricingInputs } from './types';

function n(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function calculatePricing(inputs: PricingInputs): PricingBreakdown {
  // Quy đổi giá gốc sang VND dựa theo loại tiền tệ đã chọn
  const originVnd =
    n(inputs.originCost) > 0 && n(inputs.exchangeRate) > 0
      ? inputs.originCost * inputs.exchangeRate
      : 0;

  // Thuế Nhật tính theo % trên giá gốc (đã quy đổi VND)
  const taxJapanPercent = n(inputs.taxJapanPercent);
  const taxJapanVnd = originVnd * (taxJapanPercent / 100);

  const taxVietnamVnd = n(inputs.taxVietnamVnd);
  const shipInternationalVnd = n(inputs.shipInternationalPerKgVnd) * n(inputs.weight);
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
