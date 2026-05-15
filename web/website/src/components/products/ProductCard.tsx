import React from 'react';
import { Icons } from '../Icons';
import { Link, useNavigate } from 'react-router-dom';
import { Product } from '@/types';
import { Heart, ShoppingBag as Cart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { cn } from '@/lib/utils';
import { getMediaUrl } from '@/lib/api';

interface ProductCardProps {
  product: Product;
  variant?: 'large' | 'small' | 'standard';
  key?: string | number;
}

export function ProductCard({ product, variant = 'standard' }: ProductCardProps) {
  const { t } = useTranslation();
  const isLarge = variant === 'large';
  const { addToCart } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist, isLoading: wishlistLoading, likesMap } = useWishlist();
  const navigate = useNavigate();

  const inWishlist = isInWishlist(product.id);

  // Use the likes count from the global map (polled every 5s) or fall back to product data
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
      className={`group relative flex flex-col bg-white overflow-hidden border border-surface-variant rounded-sm transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 ${isLarge ? 'h-full' : ''}`}
    >
      {/* Image Container */}
      <div className={`relative overflow-hidden ${isLarge ? 'flex-grow' : 'aspect-square'}`}>
        <img 
          src={getMediaUrl(product.image)} 
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        
        {/* Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          {product.isCheap && (
            <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-1 uppercase tracking-wider rounded-sm">
              Best Price
            </span>
          )}
          {product.sales && product.sales > 50 && (
            <span className="bg-primary text-white text-[10px] font-bold px-2 py-1 uppercase tracking-wider rounded-sm">
              Best Seller
            </span>
          )}
        </div>

        {/* Quick Actions */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center gap-4">
          <button 
            className={`p-4 rounded-full shadow-lg transition-all duration-300 scale-90 group-hover:scale-100 ${
              inWishlist ? 'bg-primary text-white' : 'bg-white text-on-surface hover:bg-primary hover:text-white'
            }`}
            onClick={handleWishlistToggle}
          >
            <Heart size={20} className={inWishlist ? 'fill-white' : ''} />
          </button>
          <button 
            className="p-4 bg-primary text-white hover:bg-primary-container rounded-full shadow-lg transition-all duration-300 scale-90 group-hover:scale-100"
            onClick={handleAddToCart}
          >
            <Cart size={20} />
          </button>
        </div>
      </div>

      {/* Product Info */}
      <div className={`p-6 flex flex-col gap-2 ${isLarge ? 'bg-surface/50' : ''}`}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-secondary font-medium">{product.category}</p>
            <h3 className={`${isLarge ? 'headline-md' : 'body-lg'} font-medium group-hover:text-primary transition-colors mt-1`}>
              {product.name}
            </h3>
          </div>
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
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <p className="label-lg font-bold">${product.price.toLocaleString()}</p>
          {product.sales && (
            <p className="text-[10px] text-secondary italic">
              {t('product.sold', { count: product.sales })}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
