import React from 'react';
import { Icons } from '../Icons';
import { Link, useNavigate } from 'react-router-dom';
import { Product } from '@/types';
import { Heart, ShoppingBag as Cart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { cn } from '@/lib/utils';
import { useFormatPrice } from '@/hooks/useFormatPrice';
import { ProductImage } from './ProductImage';

interface ProductCardProps {
  product: Product;
  variant?: 'large' | 'small' | 'standard';
  key?: string | number;
}

export function ProductCard({ product, variant = 'standard' }: ProductCardProps) {
  const { t } = useTranslation();
  const { format: formatPrice } = useFormatPrice();
  const isLarge = variant === 'large';
  const { addToCart } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist, isLoading: wishlistLoading, likesMap } = useWishlist();
  const navigate = useNavigate();

  const inWishlist = isInWishlist(product.id);

  // Use a refreshed shared count when available, otherwise use the product payload.
  const displayLikes = likesMap[product.id] ?? product.likes ?? 0;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    const success = await addToCart(product.id, 1, product.price);
    if (!success) {
      navigate('/login');
    }
  };

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (inWishlist) {
      await removeFromWishlist(product.id);
    } else {
      const success = await addToWishlist(product.id);
      if (!success) {
        navigate('/login');
      }
    }
  };
  
  return (
    <Link 
      to={`/product/${product.id}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-sm border border-surface-variant bg-white gpu-transform transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg"
    >
      {/* Image Container */}
      <div className={`relative overflow-hidden ${isLarge ? 'flex-grow' : 'aspect-square'}`}>
        <ProductImage
          src={product.image}
          alt={product.name}
          preset="card"
          fit="contain"
          className="w-full h-full gpu-transform"
        />
        
        {/* Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          {!!product.isCheap && (
            <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-1 uppercase tracking-wider rounded-sm">
              {t('product.best_price')}
            </span>
          )}
          {product.sales > 50 && (
            <span className="bg-primary text-white text-[10px] font-bold px-2 py-1 uppercase tracking-wider rounded-sm">
              {t('product.best_seller')}
            </span>
          )}
        </div>

        {/* Quick Actions */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out flex items-center justify-center gap-4">
          <button 
            className={`p-4 rounded-full shadow-lg transition-transform duration-200 ease-out scale-95 group-hover:scale-100 ${
              inWishlist ? 'bg-primary text-white' : 'bg-white text-on-surface hover:bg-primary hover:text-white'
            }`}
            onClick={handleWishlistToggle}
          >
            <Heart size={20} className={inWishlist ? 'fill-white' : ''} />
          </button>
          <button 
            className="p-4 bg-primary text-white hover:bg-primary-container rounded-full shadow-lg transition-transform duration-200 ease-out scale-95 group-hover:scale-100"
            onClick={handleAddToCart}
          >
            <Cart size={20} />
          </button>
        </div>
      </div>

      {/* Product Info */}
      <div className={cn(
        'flex flex-col gap-2 p-3 sm:p-4 lg:p-5',
        isLarge ? 'flex-1 bg-surface/50' : 'h-[138px] sm:h-[150px] lg:h-[158px]',
      )}>
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-medium uppercase tracking-[0.2em] text-secondary">
              {product.category}
            </p>
            <h3
              title={product.name}
              className={cn(
                isLarge ? 'headline-md' : 'body-lg min-h-[3rem] line-clamp-2',
                'mt-1 break-words font-medium transition-colors group-hover:text-primary',
              )}
            >
              {product.name}
            </h3>
          </div>
          {displayLikes > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-variant/30 rounded-full">
              <Heart 
                size={14} 
                className={cn(
                  "transition-all duration-300",
                  inWishlist ? "text-red-500 fill-red-500 scale-110" : "text-secondary"
                )} 
              />
              <span className={cn(
                "text-xs font-bold transition-colors duration-300",
                inWishlist ? "text-primary" : "text-secondary"
              )}>
                {displayLikes}
              </span>
            </div>
          )}
        </div>
        
        <div className="mt-auto flex min-w-0 items-center justify-between gap-2 pt-2">
          <p className="label-lg min-w-0 truncate font-bold">{formatPrice(product.price)}</p>
          {product.sales > 0 && (
            <p className="shrink-0 whitespace-nowrap text-[10px] italic text-secondary">
              {t('product.sold', { count: product.sales })}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
