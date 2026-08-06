import type { ProductFormData } from './types';
import {
  DEFAULT_PRICING_INPUTS,
  type PricingInputs,
} from '../pricing/types';

export const PRODUCT_ATTRIBUTE_FLAGS = [
  { id: 'is_featured' as const, label: 'Curated' },
  { id: 'is_new' as const, label: 'Recent' },
  { id: 'is_limited' as const, label: 'Limited' },
  { id: 'is_cheap' as const, label: 'Accessible' },
];

function fieldValue(value: unknown) {
  return value === null || value === undefined ? '' : String(value);
}

function pricingNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function productPricingInputs(product: any): PricingInputs | null {
  const saved = product?.pricing_inputs;
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    const currency = String(saved.originCurrency || '').toUpperCase();
    return {
      originCost: pricingNumber(saved.originCost, 0),
      originCurrency: currency === 'USD' ? 'USD' : 'JPY',
      exchangeRate: pricingNumber(
        saved.exchangeRate,
        currency === 'USD' ? 25000 : 170,
      ),
      taxJapanPercent: pricingNumber(saved.taxJapanPercent, 0),
      taxVietnamVnd: pricingNumber(saved.taxVietnamVnd, 0),
      shipInternationalPerKgVnd: pricingNumber(
        saved.shipInternationalPerKgVnd,
        0,
      ),
      shipJapanLocalVnd: pricingNumber(saved.shipJapanLocalVnd, 0),
      shipVietnamLocalVnd: pricingNumber(saved.shipVietnamLocalVnd, 0),
      hiddenCostVnd: pricingNumber(saved.hiddenCostVnd, 0),
      profitMarginPercent: pricingNumber(saved.profitMarginPercent, 0),
      usdToVndRate: pricingNumber(saved.usdToVndRate, 25000),
    };
  }

  const costVnd = pricingNumber(product?.cost_price_vnd, 0);
  const priceUsd = pricingNumber(product?.price, 0);
  if (costVnd <= 0) return null;
  const usdToVndRate = DEFAULT_PRICING_INPUTS.usdToVndRate;
  const sellingVnd = priceUsd * usdToVndRate;
  return {
    ...DEFAULT_PRICING_INPUTS,
    originCost: costVnd / usdToVndRate,
    originCurrency: 'USD',
    exchangeRate: usdToVndRate,
    taxJapanPercent: 0,
    shipInternationalPerKgVnd: 0,
    profitMarginPercent: Math.max((sellingVnd / costVnd - 1) * 100, 0),
  };
}

export function createEmptyProductForm(defaultCategoryId = ''): ProductFormData {
  return {
    id: `KOG-${Math.floor(1000 + Math.random() * 9000)}`,
    name: '',
    name_en: '',
    name_ja: '',
    name_vi: '',
    price: '',
    cost_price_vnd: '',
    pricing_inputs: null,
    status: 'published',
    category: defaultCategoryId,
    stock: '1',
    description: '',
    description_en: '',
    description_ja: '',
    description_vi: '',
    brand: '',
    location: '',
    weight: '',
    is_featured: false,
    is_new: true,
    is_limited: false,
    is_cheap: false,
  };
}

export function productToFormData(product: any): ProductFormData {
  return {
    id: fieldValue(product.id),
    name: fieldValue(product.name),
    name_en: fieldValue(product.name_en),
    name_ja: fieldValue(product.name_ja),
    name_vi: fieldValue(product.name_vi),
    price: fieldValue(product.price),
    cost_price_vnd: fieldValue(product.cost_price_vnd),
    pricing_inputs: productPricingInputs(product),
    status: product.status || 'published',
    category: fieldValue(product.category),
    stock: fieldValue(product.stock),
    description: fieldValue(product.description),
    description_en: fieldValue(product.description_en),
    description_ja: fieldValue(product.description_ja),
    description_vi: fieldValue(product.description_vi),
    brand: fieldValue(product.brand),
    location: fieldValue(product.location),
    weight: fieldValue(product.weight),
    is_featured: Boolean(product.is_featured),
    is_new: Boolean(product.is_new),
    is_limited: Boolean(product.is_limited),
    is_cheap: Boolean(product.is_cheap),
  };
}
