import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch } from '@/lib/api';
import { Product } from '@/types';

interface WishlistContextType {
  wishlistItems: { id: number; product: Product; created_at: string }[];
  addToWishlist: (productId: string | number) => Promise<boolean>;
  removeFromWishlist: (productId: string | number) => Promise<boolean>;
  isInWishlist: (productId: string | number) => boolean;
  isLoading: boolean;
  fetchWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [wishlistItems, setWishlistItems] = useState<{ id: number; product: Product; created_at: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWishlist = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch('/shop/favorites/');
      if (response.ok) {
        const data = await response.json();
        setWishlistItems(data);
      } else {
        setWishlistItems([]);
      }
    } catch (error) {
      console.error('Failed to fetch wishlist:', error);
      setWishlistItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      fetchWishlist();
    } else {
      setIsLoading(false);
    }
  }, []);

  const addToWishlist = async (productId: string | number) => {
    try {
      const response = await apiFetch('/shop/favorites/add/', {
        method: 'POST',
        body: JSON.stringify({ product_id: productId }),
      });
      if (response.ok) {
        await fetchWishlist(); // Refresh to get the complete item with product details
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to add to wishlist:', error);
      return false;
    }
  };

  const removeFromWishlist = async (productId: string | number) => {
    try {
      const response = await apiFetch('/shop/favorites/remove/', {
        method: 'POST',
        body: JSON.stringify({ product_id: productId }),
      });
      if (response.ok) {
        setWishlistItems(prev => prev.filter(item => item.product.id !== productId));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to remove from wishlist:', error);
      return false;
    }
  };

  const isInWishlist = (productId: string | number) => {
    return wishlistItems.some(item => item.product.id === productId);
  };

  return (
    <WishlistContext.Provider value={{ wishlistItems, addToWishlist, removeFromWishlist, isInWishlist, isLoading, fetchWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}
