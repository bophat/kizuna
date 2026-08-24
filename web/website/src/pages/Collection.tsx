import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { ProductGrid } from '@/components/products/ProductGrid';
import { Product } from '@/types';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/Icons';
import { apiFetch } from '@/lib/api';
import { SEO } from '@/components/SEO';
import { fade, scaleIn, tweenBase } from '@/lib/motion';
import { useFormatPrice } from '@/hooks/useFormatPrice';

export function CollectionPage() {
  const { t } = useTranslation();
  const { getRangeLabel, priceRangeOptions } = useFormatPrice();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [brands, setBrands] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Get filter values from URL
  const categoryFilters = useMemo(() => searchParams.get('category')?.split(',').filter(Boolean) || [], [searchParams]);
  const brandFilters = useMemo(() => searchParams.get('brand')?.split(',').filter(Boolean) || [], [searchParams]);
  const priceRangeFilter = searchParams.get('priceRange') || '';
  const statusFilters = useMemo(() => searchParams.get('filter')?.split(',').filter(Boolean) || [], [searchParams]);
  const searchQuery = searchParams.get('search') || '';
  const sortBy = searchParams.get('sort') || 'newest';

  // Brand options come from the whole catalog, not the page being shown.
  useEffect(() => {
    let active = true;
    apiFetch('/shop/products/facets/')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.brands) setBrands(data.brands);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Reset to the first page whenever the filters change, so page 7 of the old
  // result set never carries over into a smaller new one.
  useEffect(() => {
    setCurrentPage(1);
  }, [
    categoryFilters.join(','),
    brandFilters.join(','),
    priceRangeFilter,
    statusFilters.join(','),
    searchQuery,
    sortBy,
    itemsPerPage,
  ]);

  // Search, filter, sort and paging all happen in the database. Fetching the
  // full catalog and doing this in the browser did not scale past a few
  // hundred products.
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (categoryFilters.length) params.set('category', categoryFilters.join(','));
    if (brandFilters.length) params.set('brand', brandFilters.join(','));
    if (statusFilters.length) params.set('filter', statusFilters.join(','));
    if (priceRangeFilter) {
      const [min, max] = priceRangeFilter.split('-');
      if (min) params.set('price_min', min);
      if (max) params.set('price_max', max);
    }
    params.set('sort', sortBy);
    params.set('page', String(currentPage));
    params.set('page_size', String(itemsPerPage));

    const controller = new AbortController();
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await apiFetch(`/shop/products/?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(t('collection.load_error'));
        const data = await response.json();
        const rows = data.results ?? data;

        setProducts(rows.map((p: any) => ({
          ...p,
          name: String(p.name ?? ''),
          description: String(p.description ?? ''),
          brand: String(p.brand ?? ''),
          isNew: p.is_new,
          isFeatured: p.is_featured,
          isLimited: p.is_limited,
          isCheap: p.is_cheap,
          category: String(p.category_name || p.category || ''),
        })));
        setTotalCount(typeof data.count === 'number' ? data.count : rows.length);
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        console.error(err);
        setError(t('collection.load_error'));
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    fetchProducts();
    return () => controller.abort();
  }, [
    t,
    searchQuery,
    categoryFilters.join(','),
    brandFilters.join(','),
    statusFilters.join(','),
    priceRangeFilter,
    sortBy,
    currentPage,
    itemsPerPage,
  ]);

  // The server returns exactly the rows for this page already.
  const paginatedProducts = products;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

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
          : "bg-transparent border-outline-variant group-hover:border-primary/40 group-hover:scale-105"
      )}>
        {checked && (
          isRadio 
            ? <div className="w-1.5 h-1.5 rounded-full bg-white animate-in zoom-in-50 duration-300" />
            : <Icons.Check size={12} className="text-white animate-in zoom-in-50 duration-300" strokeWidth={4} />
        )}
      </div>
      <span className={cn(
        "text-sm font-medium transition-all duration-300",
        checked ? "text-primary font-bold translate-x-1" : "text-secondary group-hover:text-primary group-hover:translate-x-1"
      )}>
        {label}
      </span>
    </button>
  );

  return (
    <div className="min-h-screen bg-surface">
      <SEO title={t('seo.collections_title')} description={t('seo.collections_description')} path="/collections" />
      {/* Sticky Header & Filter Bar */}
      <div className="z-30 border-b border-surface-variant/50 bg-surface-container-lowest/95 shadow-sm backdrop-blur-md lg:sticky lg:top-20">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:py-8">
          
          {/* Title & Stats */}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold capitalize leading-tight tracking-[-0.02em] sm:text-3xl lg:text-[40px]">
              {searchQuery
                ? t('collection.search_results', { query: searchQuery })
                : t('nav.products')}
            </h1>
            <p className="mt-0.5 text-xs leading-5 text-secondary sm:mt-1 sm:text-sm lg:mt-2 lg:text-base">
              {t('filter.results', { count: totalCount })}
            </p>
          </div>

          {/* Unified Filter & Sort Button (Desktop & Mobile) */}
          <div className="flex shrink-0 items-center">
            <button 
              onClick={() => setIsFilterDrawerOpen(true)}
              className={cn(
                "flex items-center gap-1.5 rounded-full bg-inverse-surface px-3 py-2 text-xs font-bold text-inverse-on-surface transition-all duration-300 hover:bg-primary sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm lg:px-6",
                (brandFilters.length > 0 || priceRangeFilter || statusFilters.length > 0 || categoryFilters.length > 0) && "bg-primary"
              )}
            >
              <Icons.SlidersHorizontal size={15} />
              <span>{t('filter.title')}</span>
              {(brandFilters.length > 0 || priceRangeFilter || statusFilters.length > 0 || categoryFilters.length > 0) && (
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6 lg:py-10">
        {/* Active Filters Bar */}
        {(categoryFilters.length > 0 || brandFilters.length > 0 || priceRangeFilter || statusFilters.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-8 items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary mr-2">{t('collection.active')}:</span>

            {brandFilters.map(b => (
              <button key={b} onClick={() => updateFilter('brand', b, true)} className="flex items-center gap-1 px-3 py-1 bg-surface-container rounded-full text-xs hover:bg-surface-variant transition-colors">
                {b} <Icons.X size={12} />
              </button>
            ))}
            {statusFilters.map(s => (
              <button key={s} onClick={() => updateFilter('filter', s, true)} className="flex items-center gap-1 px-3 py-1 bg-surface-container rounded-full text-xs hover:bg-surface-variant transition-colors">
                {t(`home.${s}` as any) || s} <Icons.X size={12} />
              </button>
            ))}
            {priceRangeFilter && (
              <button onClick={() => updateFilter('priceRange', '')} className="flex items-center gap-1 px-3 py-1 bg-surface-container rounded-full text-xs hover:bg-surface-variant transition-colors">
                {getRangeLabel(priceRangeFilter)} <Icons.X size={12} />
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
              <Icons.Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="body-lg text-secondary">{t('common.loading')}</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="body-lg text-error mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="text-primary border-b border-primary hover:text-primary-container transition-all"
              >
                {t('product.back_to_shop')}
              </button>
            </div>
          ) : products.length > 0 ? (
            <>
              <ProductGrid products={paginatedProducts} layout="grid-6" />
              
              {/* Pagination Controls */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 border-t border-surface-variant py-4 sm:mt-10 sm:justify-between sm:gap-4 sm:py-5 lg:mt-20 lg:py-8">
                {/* Items Per Page */}
                {totalCount > 10 && <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-secondary sm:text-xs sm:tracking-widest">
                    {t('filter.show_per_page', { defaultValue: 'Show' })}:
                  </span>
                  <div className="flex gap-1 sm:gap-2">
                    {[10, 20, 50].map(size => (
                      <button
                        key={size}
                        onClick={() => setItemsPerPage(size)}
                        className={cn(
                          "h-8 w-8 rounded-full border text-[10px] font-bold transition-all duration-300 sm:h-9 sm:w-9 sm:text-xs lg:h-10 lg:w-10",
                          itemsPerPage === size 
                            ? "bg-primary border-primary text-white shadow-lg shadow-primary/20" 
                            : "bg-surface-container-lowest border-outline-variant text-secondary hover:border-primary hover:text-primary"
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>}

                {/* Page Navigation */}
                {totalPages > 1 && <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant text-secondary transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-30 sm:h-9 sm:w-9 lg:h-10 lg:w-10"
                  >
                    <Icons.ChevronLeft size={16} />
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => {
                        // Show first, last, and pages around current
                        if (totalPages <= 7) return true;
                        return p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1;
                      })
                      .map((p, i, arr) => (
                        <React.Fragment key={p}>
                          {i > 0 && arr[i-1] !== p - 1 && (
                            <span className="px-2 text-secondary">...</span>
                          )}
                          <button
                            onClick={() => setCurrentPage(p)}
                            className={cn(
                              "h-8 w-8 rounded-full text-[10px] font-bold transition-all duration-300 sm:h-9 sm:w-9 sm:text-xs lg:h-10 lg:w-10",
                              currentPage === p 
                                ? "bg-inverse-surface text-inverse-on-surface shadow-xl"
                                : "text-secondary hover:bg-surface-variant"
                            )}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      ))
                    }
                  </div>

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant text-secondary transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-30 sm:h-9 sm:w-9 lg:h-10 lg:w-10"
                  >
                    <Icons.ChevronRight size={16} />
                  </button>
                </div>}

                {/* Summary */}
                <p className="w-full text-center text-[9px] font-semibold uppercase tracking-wide text-secondary italic sm:ml-auto sm:w-auto sm:text-[10px] sm:tracking-widest">
                  {t('filter.showing_range', { 
                    defaultValue: 'Showing {{start}}-{{end}} of {{total}}',
                    start: Math.min(totalCount, (currentPage - 1) * itemsPerPage + 1),
                    end: Math.min(totalCount, currentPage * itemsPerPage),
                    total: totalCount
                  })}
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="body-lg text-secondary mb-4">
                {searchQuery
                  ? t('collection.no_search_results', { query: searchQuery })
                  : t('product.not_found')}
              </p>
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
              {...fade}
              transition={tweenBase}
              onClick={() => setIsFilterDrawerOpen(false)}
              className="fixed inset-0 bg-black/60 z-[60]"
            />
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
              <motion.div
                {...scaleIn}
                transition={tweenBase}
                className="w-full max-w-3xl max-h-[90vh] bg-surface-container-lowest rounded-2xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden gpu-transform"
              >
                {/* Header */}
                <div className="p-6 border-b border-surface-variant flex items-center justify-between shrink-0">
                  <h2 className="headline-sm">{t('filter.title')}</h2>
                  <button onClick={() => setIsFilterDrawerOpen(false)} className="p-2 hover:bg-surface-container rounded-full transition-colors">
                    <Icons.X size={24} />
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
                        {priceRangeOptions.map(range => (
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
                    className="flex-1 py-4 border border-outline-variant label-sm rounded-full font-bold hover:bg-surface-container-low transition-colors"
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
