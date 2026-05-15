import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch } from '@/lib/api';
import { Product } from '@/types';

interface WishlistContextType {
  wishlistItems: { id: number; product: Product; created_at: string }[];
  addToWishlist: (productId: string | number) => Promise<boolean>;
  removeFromWishlist: (productId: string | number) => Promise<boolean>;
  isInWishlist: (productId: string | number) => boolean;
  isLoading: boolean;
  likesMap: Record<string, number>;
  fetchWishlist: () => Promise<void>;
  fetchLikesCounts: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [wishlistItems, setWishlistItems] = useState<{ id: number; product: Product; created_at: string }[]>([]);
  const [likesMap, setLikesMap] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchLikesCounts = async () => {
    try {
      const response = await apiFetch('/shop/products/likes_counts/');
      if (response.ok) {
        const data = await response.json();
        const map: Record<string, number> = {};
        data.forEach((p: { id: string; likes: number }) => {
          map[p.id] = p.likes;
        });
        setLikesMap(map);
      }
    } catch (error) {
      console.error('Failed to fetch likes counts:', error);
    }
  };

  const fetchWishlist = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch('/shop/favorites/');
      if (response.ok) {
        const data = await response.json();
        const mappedData = data.map((item: any) => ({
          ...item,
          product: {
            ...item.product,
            isNew: item.product.is_new,
            isFeatured: item.product.is_featured,
            isLimited: item.product.is_limited,
            isCheap: item.product.is_cheap,
            category: item.product.category_name || item.product.category,
          }
        }));
        setWishlistItems(mappedData);
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

    // Always fetch likes counts, even if not logged in
    fetchLikesCounts();
    
    // Polling every 5 seconds for "realtime" updates
    const interval = setInterval(fetchLikesCounts, 5000);
    return () => clearInterval(interval);
  }, []);

  const addToWishlist = async (productId: string | number) => {
    try {
      const response = await apiFetch('/shop/favorites/add/', {
        method: 'POST',
        body: JSON.stringify({ product_id: productId }),
      });
      if (response.ok) {
        await fetchWishlist(); // Refresh to get the complete item with product details
        await fetchLikesCounts(); // Refresh likes counts immediately
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
        await fetchLikesCounts(); // Refresh likes counts immediately
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
    <WishlistContext.Provider value={{ 
      wishlistItems, 
      addToWishlist, 
      removeFromWishlist, 
      isInWishlist, 
      isLoading, 
      likesMap,
      fetchWishlist,
      fetchLikesCounts
    }}>
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
