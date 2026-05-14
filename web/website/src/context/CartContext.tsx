import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch } from '@/lib/api';

export interface CartItem {
  id: number;
  product_id: string;
  quantity: number;
  price: string;
}

export interface Cart {
  id: number;
  items: CartItem[];
  total_amount: string;
  created_at: string;
  updated_at: string;
}

interface CartContextType {
  cart: Cart | null;
  loading: boolean;
  addToCart: (product_id: string, quantity: number, price: number) => Promise<boolean>;
  updateQuantity: (product_id: string, quantity: number) => Promise<void>;
  removeFromCart: (product_id: string) => Promise<void>;
  fetchCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCart = async () => {
    try {
      const response = await apiFetch('/shop/cart/get_cart/');
      if (response.ok) {
        const data = await response.json();
        setCart(data);
      } else if (response.status === 401 || response.status === 403) {
        setCart(null);
      }
    } catch (error) {
      console.error('Failed to fetch cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (product_id: string, quantity: number, price: number) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      return false;
    }
    try {
      const response = await apiFetch('/shop/cart/add_item/', {
        method: 'POST',
        body: JSON.stringify({ product_id, quantity, price }),
      });
      if (response.ok) {
        const data = await response.json();
        setCart(data);
        return true;
      }
    } catch (error) {
      console.error('Failed to add to cart:', error);
    }
    return false;
  };

  const updateQuantity = async (product_id: string, quantity: number) => {
    try {
      const response = await apiFetch('/shop/cart/update_item/', {
        method: 'POST',
        body: JSON.stringify({ product_id, quantity }),
      });
      if (response.ok) {
        const data = await response.json();
        setCart(data);
      }
    } catch (error) {
      console.error('Failed to update quantity:', error);
    }
  };

  const removeFromCart = async (product_id: string) => {
    try {
      const response = await apiFetch('/shop/cart/remove_item/', {
        method: 'POST',
        body: JSON.stringify({ product_id }),
      });
      if (response.ok) {
        const data = await response.json();
        setCart(data);
      }
    } catch (error) {
      console.error('Failed to remove from cart:', error);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  return (
    <CartContext.Provider value={{ cart, loading, addToCart, updateQuantity, removeFromCart, fetchCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
