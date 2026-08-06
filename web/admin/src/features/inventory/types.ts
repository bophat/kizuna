export interface ProductFormData {
  id: string;
  name: string;
  name_en: string;
  name_ja: string;
  name_vi: string;
  price: string;
  cost_price_vnd: string;
  status: 'draft' | 'review' | 'published' | 'suspended';
  category: string;
  stock: string;
  description: string;
  description_en: string;
  description_ja: string;
  description_vi: string;
  brand: string;
  location: string;
  weight: string;
  is_featured: boolean;
  is_new: boolean;
  is_limited: boolean;
  is_cheap: boolean;
}
