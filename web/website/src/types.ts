export interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  category: string;
  location: string;
  description: string;
  image: string;
  gallery?: { id: number; image: string; is_primary: boolean }[];
  artist?: string;
  brand?: string;
  isLimited?: boolean;
  isNew?: boolean;
  isFeatured?: boolean;
  likes?: number;
  sales?: number;
  isCheap?: boolean;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Order {
  id: string;
  date: string;
  status: 'Confirmed' | 'Shipping from Japan' | 'Customs Clearance' | 'Delivered' | 'In Transit';
  items: CartItem[];
  total: number;
}

export interface Notification {
  id: string;
  type: 'quote' | 'order' | 'progress' | 'promo';
  title: string;
  message: string;
  time: string;
  actionLabel?: string;
  accent?: boolean;
}
