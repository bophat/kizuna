import type { ProductFormData } from './types';

export const PRODUCT_ATTRIBUTE_FLAGS = [
  { id: 'is_featured' as const, label: 'Curated' },
  { id: 'is_new' as const, label: 'Recent' },
  { id: 'is_limited' as const, label: 'Limited' },
  { id: 'is_cheap' as const, label: 'Accessible' },
];

function fieldValue(value: unknown) {
  return value === null || value === undefined ? '' : String(value);
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
