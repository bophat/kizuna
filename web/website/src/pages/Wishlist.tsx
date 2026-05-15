import React from 'react';
import { motion } from 'motion/react';
import { useWishlist } from '@/context/WishlistContext';
import { useTranslation } from 'react-i18next';
import { ProductCard } from '@/components/products/ProductCard';
import { EmptyState } from '@/components/EmptyState';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

export function WishlistPage() {
  const { t } = useTranslation();
  const { wishlistItems, isLoading } = useWishlist();

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-surface-variant border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-12 md:py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mb-12">
          <h1 className="headline-xl">{t('wishlist.title')}</h1>
          <p className="body-md text-secondary mt-2">
            {t(wishlistItems.length === 1 ? 'wishlist.item_saved' : 'wishlist.items_saved', { count: wishlistItems.length })}
          </p>
        </div>

        {wishlistItems.length === 0 ? (
          <EmptyState 
            icon={<Heart size={48} />}
            title={t('wishlist.empty_title')}
            description={t('wishlist.empty_description')}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {wishlistItems.map((item) => (
              <ProductCard key={item.id} product={item.product} />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
