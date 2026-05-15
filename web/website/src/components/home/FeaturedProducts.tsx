import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Product } from '@/types';
import { apiFetch } from '@/lib/api';

export function FeaturedProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await apiFetch('/shop/products/');
        if (!res.ok) throw new Error('Failed to fetch products');
        const data = await res.json();
        const mapped: Product[] = data.map((p: any) => ({
          ...p,
          isNew: p.is_new,
          isFeatured: p.is_featured,
          isLimited: p.is_limited,
          isCheap: p.is_cheap,
          category: p.category_name || p.category,
        }));
        // Show featured products, fallback to first products
        const featured = mapped.filter(p => p.isFeatured);
        setProducts(featured.length > 0 ? featured : mapped);
      } catch (err) {
        console.error('Failed to load featured products:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  if (isLoading) {
    return (
      <section className="px-8 max-w-[1280px] mx-auto w-full mb-xl">
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  const main = products[0];
  const side = products.slice(1, 3);

  return (
    <section className="px-8 max-w-[1280px] mx-auto w-full mb-xl">
      <div className="flex items-center justify-between mb-8 border-b border-surface-variant pb-2">
        <h2 className="headline-md">Featured Collection</h2>
        <Link to="/collections?filter=featured" className="label-sm text-tertiary hover:text-primary transition-colors border-b border-transparent hover:border-primary pb-1">
          View All
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Main Feature */}
        <Link to={`/collections`} className="md:col-span-8 group cursor-pointer">
          <div className="relative aspect-[16/10] overflow-hidden rounded-sm border border-surface-variant">
            {main.image ? (
              <img
                src={main.image}
                alt={main.name}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="h-full w-full bg-surface-container" />
            )}
            {main.isLimited && (
              <div className="absolute top-4 left-4 bg-white/90 border border-surface-variant px-3 py-1 label-sm">
                Limited Edition
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-between items-start">
            <div>
              <h3 className="label-md lowercase tracking-tight">{main.name}</h3>
              <p className="body-md text-secondary mt-1">{main.location}</p>
            </div>
            <span className="label-md">${main.price}</span>
          </div>
        </Link>
        {/* Side Items */}
        <div className="md:col-span-4 flex flex-col gap-6">
          {side.map((product) => (
            <Link key={product.id} to={`/collections`} className="group cursor-pointer flex-1">
              <div className="relative aspect-[4/3] overflow-hidden rounded-sm border border-surface-variant">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full bg-surface-container" />
                )}
              </div>
              <div className="mt-4 flex justify-between items-start">
                <div>
                  <h3 className="label-md lowercase tracking-tight">{product.name}</h3>
                  <p className="body-md text-secondary mt-1">{product.location}</p>
                </div>
                <span className="label-md">${product.price}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
