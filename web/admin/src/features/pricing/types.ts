export interface PricingInputs {
  originCostVnd: number;
  taxJapanVnd: number;
  taxVietnamVnd: number;
  shipInternationalVnd: number;
  shipJapanLocalVnd: number;
  shipVietnamLocalVnd: number;
  hiddenCostVnd: number;
  profitMarginPercent: number;
  /** Optional: giá JPY tại Nhật, quy đổi bằng tỷ giá */
  originCostJpy: number;
  jpyToVndRate: number;
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
  originCostVnd: 0,
  taxJapanVnd: 0,
  taxVietnamVnd: 0,
  shipInternationalVnd: 0,
  shipJapanLocalVnd: 0,
  shipVietnamLocalVnd: 0,
  hiddenCostVnd: 0,
  profitMarginPercent: 20,
  originCostJpy: 0,
  jpyToVndRate: 170,
  usdToVndRate: 25000,
};
