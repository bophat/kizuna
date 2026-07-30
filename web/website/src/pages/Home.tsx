import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Product } from '../types';
import { ProductGrid } from '../components/products/ProductGrid';
import { apiFetch, getMediaUrl } from '@/lib/api';
import { optimizeImageUrl, IMAGE_WIDTH } from '@izuna/shared/lib/image';
import {
  PUBLIC_CONTENT_KEYS,
  contentOrFallback,
  localizedContentValue,
  parsePublicSettings,
} from '@izuna/shared/lib/publicSettings';

const DEFAULT_HERO_IMAGE =
  'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=2070&auto=format&fit=crop';

export function HomePage() {
  const { t, i18n } = useTranslation();
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [heroImage, setHeroImage] = useState<string>(DEFAULT_HERO_IMAGE);
  const [publicSettings, setPublicSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    apiFetch('/shop/settings/')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: unknown) => {
        const byKey = parsePublicSettings(data);
        setPublicSettings(byKey);
        if (byKey[PUBLIC_CONTENT_KEYS.homeHeroImage]) {
          setHeroImage(getMediaUrl(byKey[PUBLIC_CONTENT_KEYS.homeHeroImage]));
        }
      })
      .catch(() => {});

    const fetchProducts = async () => {
      try {
        const mapProduct = (p: any): Product => ({
          ...p,
          isNew: p.is_new,
          isFeatured: p.is_featured,
          isLimited: p.is_limited,
          isCheap: p.is_cheap,
          category: p.category_name || p.category,
        });

        const response = await apiFetch('/shop/products/home/');
        if (response.ok) {
          const data = await response.json();
          setNewArrivals((data.new_arrivals || []).map(mapProduct));
          setFeatured((data.featured || []).map(mapProduct));
        } else {
          // Backward-compatible while the new Cloud Run revision is deploying.
          const fallbackResponse = await apiFetch('/shop/products/');
          if (!fallbackResponse.ok) throw new Error('Failed to fetch');
          const products: Product[] = (await fallbackResponse.json()).map(mapProduct);
          const arrivals = products.filter((product) => product.isNew);
          const highlighted = products.filter((product) => product.isFeatured);
          setNewArrivals((arrivals.length ? arrivals : products).slice(0, 3));
          setFeatured((highlighted.length ? highlighted : products).slice(0, 4));
        }
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, [i18n.language]);

  const displayTitle = contentOrFallback(
    localizedContentValue(publicSettings, PUBLIC_CONTENT_KEYS.homeHeroTitle, i18n.language),
    t('hero.title'),
  );
  const displaySubtitle = contentOrFallback(
    localizedContentValue(publicSettings, PUBLIC_CONTENT_KEYS.homeHeroSubtitle, i18n.language),
    t('hero.subtitle'),
  );
  const displayCta = contentOrFallback(
    localizedContentValue(publicSettings, PUBLIC_CONTENT_KEYS.homeHeroCta, i18n.language),
    t('hero.cta'),
  );

  return (
    <div className="flex flex-col gap-xl pb-20">
      {/* Hero Section */}
      <section className="relative h-[70vh] min-h-[500px] w-full overflow-hidden bg-surface-container-highest">
        <img
          src={optimizeImageUrl(heroImage, IMAGE_WIDTH.hero)}
          alt={displayTitle}
          width={IMAGE_WIDTH.hero}
          height={Math.round(IMAGE_WIDTH.hero * 0.6)}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover object-center animate-hero-zoom gpu-transform"
        />
        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-xl text-center">
          <div className="max-w-2xl animate-fade-up">
            <h1 className="headline-xl text-white mb-4">{displayTitle}</h1>
            <p className="body-lg text-white/90 mb-8">
              {displaySubtitle}
            </p>
            <Link
              to="/collections"
              className="inline-flex bg-primary-container text-white label-md px-10 py-4 rounded-sm hover:bg-primary transition-colors"
            >
              {displayCta}
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
          <ProductGrid products={newArrivals} layout="grid-3" />
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
          <ProductGrid products={featured} layout="grid-4" />
        )}
      </section>
    </div>
  );
}
