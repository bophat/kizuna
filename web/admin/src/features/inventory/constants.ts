import type { ProductFormData } from './types';

export const PRODUCT_ATTRIBUTE_FLAGS = [
  { id: 'is_featured' as const, label: 'Curated' },
  { id: 'is_new' as const, label: 'Recent' },
  { id: 'is_limited' as const, label: 'Limited' },
  { id: 'is_cheap' as const, label: 'Accessible' },
];

export function createEmptyProductForm(defaultCategoryId = ''): ProductFormData {
  return {
    id: `KOG-${Math.floor(1000 + Math.random() * 9000)}`,
    name: '',
    price: '',
    category: defaultCategoryId,
    stock: '1',
    description: '',
    brand: '',
    location: '',
    is_featured: false,
    is_new: true,
    is_limited: false,
    is_cheap: false,
  };
}

export function productToFormData(product: any): ProductFormData {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    category: product.category || '',
    stock: product.stock,
    description: product.description,
    brand: product.brand || '',
    location: product.location || '',
    is_featured: product.is_featured,
    is_new: product.is_new,
    is_limited: product.is_limited,
    is_cheap: product.is_cheap,
  };
}
