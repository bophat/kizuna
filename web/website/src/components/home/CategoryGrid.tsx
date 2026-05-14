import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface Category {
  id: number;
  name: string;
  slug: string;
}

// Fallback images per category slug/name (in case category has no image yet)
const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  ceramics: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?q=80&w=800&auto=format&fit=crop',
  textiles: 'https://images.unsplash.com/photo-1520903074185-8ec362b39c67?q=80&w=800&auto=format&fit=crop',
  woodwork: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?q=80&w=800&auto=format&fit=crop',
  tea: 'https://images.unsplash.com/photo-1544787210-2211d40369cc?q=80&w=800&auto=format&fit=crop',
};

function getCategoryImage(cat: Category): string {
  const key = (cat.slug || cat.name).toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_FALLBACK_IMAGES)) {
    if (key.includes(k)) return v;
  }
  // Generic fallback
  return 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=800&auto=format&fit=crop';
}

export function CategoryGrid() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/shop/categories/');
        if (!res.ok) throw new Error('Failed to fetch categories');
        const data = await res.json();
        setCategories(data);
      } catch (err) {
        console.error('Failed to load categories:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCategories();
  }, []);

  if (isLoading) {
    return (
      <section className="px-8 max-w-[1280px] mx-auto w-full">
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  if (categories.length === 0) return null;

  return (
    <section className="px-8 max-w-[1280px] mx-auto w-full">
      <div className="flex items-center justify-between mb-8 border-b border-surface-variant pb-2">
        <h2 className="headline-md">Curated Categories</h2>
        <Link to="/collections" className="label-sm text-tertiary hover:text-primary transition-colors border-b border-transparent hover:border-primary pb-1">
          View All
        </Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            to={`/collections?category=${cat.slug || cat.name.toLowerCase()}`}
            className="group relative block aspect-square overflow-hidden rounded-sm border border-surface-variant"
          >
            <img
              src={getCategoryImage(cat)}
              alt={cat.name}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
            <div className="absolute bottom-4 left-4">
              <span className="bg-white/90 px-4 py-2 label-sm text-on-surface">
                {cat.name}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
