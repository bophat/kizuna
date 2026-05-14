import React from 'react';
import { ProductCard } from './ProductCard';
import { Product } from '@/types';

type LayoutType = 'horizontal' | 'grid-2' | 'grid-3' | 'grid-4' | 'grid-6' | 'grid-8';

interface ProductGridProps {
  products: Product[];
  layout: LayoutType;
}

export function ProductGrid({ products, layout }: ProductGridProps) {
  if (products.length === 0) return null;

  // 1. Layout ngang (Equal sizes)
  if (layout === 'horizontal') {
    return (
      <div className="flex flex-nowrap overflow-x-auto gap-6 pb-4 no-scrollbar">
        {products.map(product => (
          <div key={product.id} className="min-w-[280px] flex-shrink-0">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    );
  }

  // 3. Layout Grid (2x2, 3x3, 4x4)
  const gridCols = {
    'grid-2': 'grid-cols-2',
    'grid-3': 'grid-cols-2 lg:grid-cols-3',
    'grid-4': 'grid-cols-2 lg:grid-cols-4',
    'grid-6': 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
    'grid-8': 'grid-cols-2 md:grid-cols-4 lg:grid-cols-8'
  };

  return (
    <div className={`grid ${gridCols[layout as keyof typeof gridCols] || 'grid-cols-4'} gap-6`}>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
