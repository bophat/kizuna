export type OriginCurrency = 'JPY' | 'USD';

export interface PricingInputs {
  /** Giá gốc (nhập bằng JPY hoặc USD tuỳ chọn) */
  originCost: number;
  /** Loại tiền tệ đầu vào */
  originCurrency: OriginCurrency;
  /** Tỷ giá đổi sang VND (tuỳ theo originCurrency) */
  exchangeRate: number;
  /** Thuế Nhật tính theo phần trăm (8–10%) */
  taxJapanPercent: number;
  taxVietnamVnd: number;
  weight: number;
  shipInternationalPerKgVnd: number;
  shipJapanLocalVnd: number;
  shipVietnamLocalVnd: number;
  hiddenCostVnd: number;
  profitMarginPercent: number;
  usdToVndRate: number;
}

export interface PricingBreakdown {
  originVnd: number;
  taxJapanVnd: number;
  taxVietnamVnd: number;
  shipInternationalVnd: number;
  shipJapanLocalVnd: number;
  shipVietnamLocalVnd: number;
  hiddenCostVnd: number;
  totalCostVnd: number;
  breakEvenVnd: number;
  sellingPriceVnd: number;
  profitVnd: number;
  sellingPriceUsd: number;
  profitMarginPercent: number;
}

export const DEFAULT_PRICING_INPUTS: PricingInputs = {
  originCost: 0,
  originCurrency: 'JPY',
  exchangeRate: 170,
  taxJapanPercent: 10,
  taxVietnamVnd: 0,
  weight: 0,
  shipInternationalPerKgVnd: 180000,
  shipJapanLocalVnd: 0,
  shipVietnamLocalVnd: 0,
  hiddenCostVnd: 0,
  profitMarginPercent: 20,
  usdToVndRate: 25000,
};
