import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { Filter, X, ChevronDown, LayoutGrid, List, SlidersHorizontal, Loader2 } from 'lucide-react';
import { ProductGrid } from '@/components/products/ProductGrid';
import { Product } from '@/types';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/Icons';
import { apiFetch } from '@/lib/api';

export function CollectionPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        const response = await apiFetch('/shop/products/');
        if (!response.ok) throw new Error('Failed to fetch products');
        const data = await response.json();
        
        const mappedProducts: Product[] = data.map((p: any) => ({
          ...p,
          isNew: p.is_new,
          isFeatured: p.is_featured,
          isLimited: p.is_limited,
          isCheap: p.is_cheap,
          category: p.category_name || p.category,
        }));
        setProducts(mappedProducts);
      } catch (err) {
        console.error(err);
        setError('Failed to load products');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Get filter values from URL
  const categoryFilters = useMemo(() => searchParams.get('category')?.split(',').filter(Boolean) || [], [searchParams]);
  const brandFilters = useMemo(() => searchParams.get('brand')?.split(',').filter(Boolean) || [], [searchParams]);
  const priceRangeFilter = searchParams.get('priceRange') || '';
  const statusFilters = useMemo(() => searchParams.get('filter')?.split(',').filter(Boolean) || [], [searchParams]);
  const searchQuery = searchParams.get('search') || '';
  const sortBy = searchParams.get('sort') || 'newest';

  const brands = useMemo(() => {
    const uniqueBrands = new Set(products.map(p => p.brand).filter(Boolean));
    return Array.from(uniqueBrands) as string[];
  }, [products]);

  // Filtering Logic
  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.description.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        p.brand?.toLowerCase().includes(query)
      );
    }

    if (categoryFilters.length > 0) {
      result = result.filter(p => categoryFilters.includes(p.category.toLowerCase()));
    }

    if (brandFilters.length > 0) {
      result = result.filter(p => p.brand && brandFilters.includes(p.brand));
    }

    if (priceRangeFilter) {
      const [min, max] = priceRangeFilter.split('-').map(Number);
      result = result.filter(p => {
        if (max) return p.price >= min && p.price <= max;
        return p.price >= min;
      });
    }

    if (statusFilters.length > 0) {
      const filtered = result.filter(p => {
        if (statusFilters.includes('new') && p.isNew) return true;
        if (statusFilters.includes('featured') && p.isFeatured) return true;
        if (statusFilters.includes('best_sellers') && (p.sales || 0) > 50) return true;
        if (statusFilters.includes('top_rated') && (p.likes || 0) > 50) return true;
        return false;
      });
      // If filter yields results use them, otherwise show all products
      if (filtered.length > 0) result = filtered;
    }

    // Apply Sorting
    switch (sortBy) {
      case 'price-low':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'sales':
        result.sort((a, b) => (b.sales || 0) - (a.sales || 0));
        break;
      case 'likes':
        result.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        break;
      case 'newest':
      default:
        // Assume default order in PRODUCTS or sort by isNew
        result.sort((a, b) => (a.isNew === b.isNew ? 0 : a.isNew ? -1 : 1));
        break;
    }

    return result;
  }, [products, categoryFilters, brandFilters, priceRangeFilter, statusFilters, searchQuery, sortBy]);

  const updateFilter = (key: string, value: string, multi = false) => {
    const newParams = new URLSearchParams(searchParams);
    if (!value) {
      newParams.delete(key);
    } else if (multi) {
      const currentValues = newParams.get(key)?.split(',').filter(Boolean) || [];
      if (currentValues.includes(value)) {
        const filtered = currentValues.filter(v => v !== value);
        if (filtered.length > 0) newParams.set(key, filtered.join(','));
        else newParams.delete(key);
      } else {
        currentValues.push(value);
        newParams.set(key, currentValues.join(','));
      }
    } else {
      newParams.set(key, value);
    }
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const FilterCheckbox = ({ 
    label, 
    checked, 
    onChange,
    isRadio = false
  }: { 
    label: string; 
    checked: boolean; 
    onChange: () => void;
    isRadio?: boolean;
    key?: string | number;
  }) => (
    <button
      onClick={onChange}
      className="flex items-center gap-3 group w-full text-left py-2 px-2 rounded-lg hover:bg-surface-variant transition-colors"
    >
      <div className={cn(
        "w-5 h-5 flex items-center justify-center transition-all duration-300 border-2",
        isRadio ? "rounded-full" : "rounded-sm",
        checked 
          ? "bg-primary border-primary shadow-[0_0_12px_rgba(153,5,29,0.3)] scale-105" 
          : "bg-transparent border-zinc-200 dark:border-zinc-800 group-hover:border-primary/40 group-hover:scale-105"
      )}>
        {checked && (
          isRadio 
            ? <div className="w-1.5 h-1.5 rounded-full bg-white animate-in zoom-in-50 duration-300" />
            : <Icons.Check size={12} className="text-white animate-in zoom-in-50 duration-300" strokeWidth={4} />
        )}
      </div>
      <span className={cn(
        "text-sm font-medium transition-all duration-300",
        checked ? "text-primary font-bold translate-x-1" : "text-zinc-600 dark:text-zinc-400 group-hover:text-primary group-hover:translate-x-1"
      )}>
        {label}
      </span>
    </button>
  );

  return (
    <div className="min-h-screen bg-surface">
      {/* Sticky Header & Filter Bar */}
      <div className="sticky top-20 z-30 bg-white/95 backdrop-blur-md border-b border-surface-variant/50 shadow-sm">
        <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-6 md:py-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          
          {/* Title & Stats */}
          <div>
            <h1 className="headline-xl capitalize">
              {searchQuery ? `Search Results for "${searchQuery}"` : t('nav.products')}
            </h1>
            <p className="body-md text-secondary mt-2">
              {filteredProducts.length} {t('nav.products').toLowerCase()} available
            </p>
          </div>

          {/* Unified Filter & Sort Button (Desktop & Mobile) */}
          <div className="flex items-center shrink-0">
            <button 
              onClick={() => setIsFilterDrawerOpen(true)}
              className={cn(
                "flex items-center gap-2 text-sm font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 rounded-full hover:bg-primary transition-all duration-300",
                (brandFilters.length > 0 || priceRangeFilter || statusFilters.length > 0 || categoryFilters.length > 0) && "bg-primary"
              )}
            >
              <SlidersHorizontal size={16} />
              <span>{t('filter.title')}</span>
              {(brandFilters.length > 0 || priceRangeFilter || statusFilters.length > 0 || categoryFilters.length > 0) && (
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 py-10">
        {/* Active Filters Bar */}
        {(categoryFilters.length > 0 || brandFilters.length > 0 || priceRangeFilter || statusFilters.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-8 items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mr-2">Active:</span>

            {brandFilters.map(b => (
              <button key={b} onClick={() => updateFilter('brand', b, true)} className="flex items-center gap-1 px-3 py-1 bg-surface-container rounded-full text-xs hover:bg-surface-variant transition-colors">
                {b} <X size={12} />
              </button>
            ))}
            {statusFilters.map(s => (
              <button key={s} onClick={() => updateFilter('filter', s, true)} className="flex items-center gap-1 px-3 py-1 bg-surface-container rounded-full text-xs hover:bg-surface-variant transition-colors">
                {t(`home.${s}` as any) || s} <X size={12} />
              </button>
            ))}
            {priceRangeFilter && (
              <button onClick={() => updateFilter('priceRange', '')} className="flex items-center gap-1 px-3 py-1 bg-surface-container rounded-full text-xs hover:bg-surface-variant transition-colors">
                {priceRangeFilter} <X size={12} />
              </button>
            )}
            <button onClick={clearFilters} className="text-xs text-primary font-bold hover:underline ml-2">
              {t('filter.clear_all')}
            </button>
          </div>
        )}

        <main className="w-full">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="body-lg text-secondary">Loading collection...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="body-lg text-red-500 mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="text-primary border-b border-primary hover:text-primary-container transition-all"
              >
                Try Again
              </button>
            </div>
          ) : filteredProducts.length > 0 ? (
            <ProductGrid products={filteredProducts} layout="grid-6" />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="body-lg text-secondary mb-4">No products found matching your criteria.</p>
              <button 
                onClick={clearFilters}
                className="text-primary border-b border-primary hover:text-primary-container hover:border-primary-container transition-all"
              >
                {t('filter.clear_all')}
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Filter Drawer */}
      <AnimatePresence>
        {isFilterDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterDrawerOpen(false)}
              className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
            />
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden"
              >
                {/* Header */}
                <div className="p-6 border-b border-surface-variant flex items-center justify-between shrink-0">
                  <h2 className="headline-sm">{t('filter.title')}</h2>
                  <button onClick={() => setIsFilterDrawerOpen(false)} className="p-2 hover:bg-surface-container rounded-full transition-colors">
                    <X size={24} />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-12">
                    {/* Sort */}
                    <div>
                      <h3 className="label-sm font-bold mb-6 uppercase tracking-[0.2em] text-secondary border-b border-surface-variant pb-2">
                        {t('filter.sort_by')}
                      </h3>
                      <div className="flex flex-col gap-1">
                        {[
                          { id: 'newest', label: t('filter.newest') },
                          { id: 'sales', label: t('filter.best_sellers') },
                          { id: 'likes', label: t('filter.likes') },
                          { id: 'price-low', label: t('filter.price_low_high') },
                          { id: 'price-high', label: t('filter.price_high_low') }
                        ].map(sort => (
                          <FilterCheckbox
                            key={sort.id}
                            label={sort.label}
                            checked={sortBy === sort.id}
                            onChange={() => updateFilter('sort', sort.id)}
                            isRadio
                          />
                        ))}
                      </div>
                    </div>

                    {/* Status */}
                    <div>
                      <h3 className="label-sm font-bold mb-6 uppercase tracking-[0.2em] text-secondary border-b border-surface-variant pb-2">
                        {t('filter.title')}
                      </h3>
                      <div className="flex flex-col gap-1">
                        {[
                          { id: 'new', label: t('home.arrivals') },
                          { id: 'featured', label: t('home.featured') },
                          { id: 'best_sellers', label: t('filter.best_sellers') },
                          { id: 'top_rated', label: t('filter.top_rated') }
                        ].map(status => (
                          <FilterCheckbox
                            key={status.id}
                            label={status.label}
                            checked={statusFilters.includes(status.id)}
                            onChange={() => updateFilter('filter', status.id, true)}
                          />
                        ))}
                      </div>
                    </div>



                    {/* Brand */}
                    <div>
                      <h3 className="label-sm font-bold mb-6 uppercase tracking-[0.2em] text-secondary border-b border-surface-variant pb-2">
                        {t('filter.brands')}
                      </h3>
                      <div className="flex flex-col gap-1">
                        {brands.map(brand => (
                          <FilterCheckbox
                            key={brand}
                            label={brand}
                            checked={brandFilters.includes(brand)}
                            onChange={() => updateFilter('brand', brand, true)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Price Range */}
                    <div className="md:col-span-2">
                      <h3 className="label-sm font-bold mb-6 uppercase tracking-[0.2em] text-secondary border-b border-surface-variant pb-2">
                        {t('filter.price_range')}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {[
                          { label: 'Under $100', value: '0-100' },
                          { label: '$100 - $300', value: '100-300' },
                          { label: '$300 - $500', value: '300-500' },
                          { label: 'Over $500', value: '500' }
                        ].map(range => (
                          <FilterCheckbox
                            key={range.value}
                            label={range.label}
                            checked={priceRangeFilter === range.value}
                            onChange={() => updateFilter('priceRange', range.value)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-surface-variant flex gap-4 shrink-0 bg-surface">
                  <button 
                    onClick={clearFilters}
                    className="flex-1 py-4 border border-zinc-200 dark:border-zinc-800 label-sm rounded-full font-bold hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                  >
                    {t('filter.clear_all')}
                  </button>
                  <button 
                    onClick={() => setIsFilterDrawerOpen(false)}
                    className="flex-1 py-4 bg-primary text-white label-sm rounded-full font-bold shadow-lg shadow-primary/20 hover:bg-primary-container transition-colors"
                  >
                    {t('filter.apply')}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
