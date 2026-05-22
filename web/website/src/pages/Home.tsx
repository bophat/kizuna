import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Product } from '../types';
import { ProductGrid } from '../components/products/ProductGrid';
import { apiFetch } from '@/lib/api';
import { optimizeImageUrl, IMAGE_WIDTH } from '@izuna/shared/lib/image';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=2070&auto=format&fit=crop';

export function HomePage() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await apiFetch('/shop/products/');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        const mapped: Product[] = data.map((p: any) => ({
          ...p,
          isNew: p.is_new,
          isFeatured: p.is_featured,
          isLimited: p.is_limited,
          isCheap: p.is_cheap,
          category: p.category_name || p.category,
        }));
        setProducts(mapped);
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const newArrivals = products.filter(p => p.isNew).slice(0, 3);
  const featured = products.filter(p => p.isFeatured).slice(0, 4);

  return (
    <div className="flex flex-col gap-xl pb-20">
      {/* Hero Section */}
      <section className="relative h-[70vh] min-h-[500px] w-full overflow-hidden bg-surface-container-highest">
        <img
          src={optimizeImageUrl(HERO_IMAGE, IMAGE_WIDTH.hero)}
          alt={t('hero.title')}
          width={IMAGE_WIDTH.hero}
          height={Math.round(IMAGE_WIDTH.hero * 0.6)}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover object-center animate-hero-zoom gpu-transform"
        />
        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-xl text-center">
          <div className="max-w-2xl animate-fade-up">
            <h1 className="headline-xl text-white mb-4">{t('hero.title')}</h1>
            <p className="body-lg text-white/90 mb-8">
              {t('hero.subtitle')}
            </p>
            <Link
              to="/collections"
              className="inline-flex bg-primary-container text-white label-md px-10 py-4 rounded-sm hover:bg-primary transition-colors"
            >
              {t('hero.cta')}
            </Link>
          </div>
        </div>
      </section>

      {/* New Arrivals Section */}
      <section className="px-8 max-w-[1280px] mx-auto w-full py-10">
        <div className="flex items-center justify-between mb-8 border-b border-surface-variant pb-2">
          <h2 className="headline-md">{t('home.arrivals')}</h2>
          <Link to="/collections?sort=newest" className="label-sm text-tertiary hover:text-primary transition-colors border-b border-transparent hover:border-primary pb-1">
            {t('home.view_all')}
          </Link>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <ProductGrid products={newArrivals.length > 0 ? newArrivals : products.slice(0, 3)} layout="grid-3" />
        )}
      </section>

      {/* Featured Items Section */}
      <section className="px-8 max-w-[1280px] mx-auto w-full py-10">
        <div className="flex items-center justify-between mb-8 border-b border-surface-variant pb-2">
          <h2 className="headline-md">{t('home.featured')}</h2>
          <Link to="/collections?sort=sales" className="label-sm text-tertiary hover:text-primary transition-colors border-b border-transparent hover:border-primary pb-1">
            {t('home.view_all')}
          </Link>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <ProductGrid products={featured.length > 0 ? featured : products.slice(3, 7)} layout="grid-4" />
        )}
      </section>
    </div>
  );
}
