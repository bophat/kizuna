import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Heart, ShoppingBag, ArrowLeft, Loader2, Minus, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { ProductGrid } from '@/components/products/ProductGrid';
import { cn } from '@/lib/utils';

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  
  const { addToCart } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();

  useEffect(() => {
    const fetchProductDetails = async () => {
      try {
        setIsLoading(true);
        // Fetch specific product
        const response = await fetch(`/api/shop/products/${id}/`);
        if (!response.ok) throw new Error('Product not found');
        const p = await response.json();
        
        const mappedProduct: Product = {
          ...p,
          isNew: p.is_new,
          isFeatured: p.is_featured,
          isLimited: p.is_limited,
          isCheap: p.is_cheap,
          category: p.category_name || p.category,
        };
        
        setProduct(mappedProduct);
        setSelectedImage(mappedProduct.image);
        
        // Fetch all products for "Related Products" section
        const relatedRes = await fetch('/api/shop/products/');
        if (relatedRes.ok) {
          const allProds = await relatedRes.json();
          const mappedAll = allProds.map((ap: any) => ({
            ...ap,
            isNew: ap.is_new,
            isFeatured: ap.is_featured,
            isLimited: ap.is_limited,
            isCheap: ap.is_cheap,
            category: ap.category_name || ap.category,
          }));
          
          // Filter out current product, and prefer same category
          let related = mappedAll.filter((ap: Product) => ap.id !== mappedProduct.id);
          const sameCategory = related.filter((ap: Product) => ap.category === mappedProduct.category);
          
          if (sameCategory.length > 0) {
            related = sameCategory;
          }
          
          setRelatedProducts(related.slice(0, 4)); // Get up to 4 related products
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load product details');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (id) {
      fetchProductDetails();
      window.scrollTo(0, 0);
    }
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
        <p className="text-error mb-4">{error || 'Product not found'}</p>
        <button 
          onClick={() => navigate('/collections')}
          className="px-6 py-2 bg-primary text-white rounded-full font-medium"
        >
          Back to Shop
        </button>
      </div>
    );
  }

  const inWishlist = isInWishlist(product.id);
  
  // Combine main image with gallery images if any
  const galleryImages = [product.image];
  if (product.gallery && product.gallery.length > 0) {
    product.gallery.forEach(g => {
      if (!galleryImages.includes(g.image)) {
        galleryImages.push(g.image);
      }
    });
  } else {
    // For demo purposes if gallery is empty, duplicate the main image 3 times to show the UI
    galleryImages.push(product.image, product.image, product.image);
  }

  const handleAddToCart = async () => {
    const success = await addToCart(product.id, quantity, product.price);
    if (!success) {
      navigate('/login');
    }
  };

  const handleWishlistToggle = async () => {
    if (inWishlist) {
      await removeFromWishlist(product.id);
    } else {
      const success = await addToWishlist(product.id);
      if (!success) {
        navigate('/login');
      }
    }
  };

  const increaseQuantity = () => {
    if (quantity < (product.stock || 10)) {
      setQuantity(prev => prev + 1);
    }
  };

  const decreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = galleryImages.indexOf(selectedImage);
    const newIndex = currentIndex > 0 ? currentIndex - 1 : galleryImages.length - 1;
    setSelectedImage(galleryImages[newIndex]);
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = galleryImages.indexOf(selectedImage);
    const newIndex = currentIndex < galleryImages.length - 1 ? currentIndex + 1 : 0;
    setSelectedImage(galleryImages[newIndex]);
  };

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 pt-8">
        
        {/* Breadcrumb / Back */}
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-secondary hover:text-on-surface transition-colors mb-8"
        >
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 mb-20">
          
          {/* Column 1: Image Gallery */}
          <div className="flex flex-col gap-4">
            <div className="aspect-square bg-surface-variant/20 rounded-2xl overflow-hidden border border-surface-variant relative group">
              <motion.img 
                key={selectedImage}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                src={selectedImage} 
                alt={product.name}
                className="w-full h-full object-cover"
              />
              
              {/* Navigation Arrows */}
              {galleryImages.length > 1 && (
                <>
                  <button
                    onClick={handlePrevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-on-surface opacity-0 group-hover:opacity-100 transition-all hover:bg-white shadow-md hover:scale-110"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={handleNextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-on-surface opacity-0 group-hover:opacity-100 transition-all hover:bg-white shadow-md hover:scale-110"
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}
              
              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {product.isNew && (
                  <span className="bg-blue-500 text-white text-[10px] font-bold px-3 py-1 uppercase tracking-wider rounded-sm">
                    New
                  </span>
                )}
                {product.isCheap && (
                  <span className="bg-green-500 text-white text-[10px] font-bold px-3 py-1 uppercase tracking-wider rounded-sm">
                    Best Price
                  </span>
                )}
              </div>
            </div>
            
            {/* Thumbnails */}
            {galleryImages.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                {galleryImages.map((img, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setSelectedImage(img)}
                    className={cn(
                      "aspect-square rounded-lg overflow-hidden border-2 transition-all",
                      selectedImage === img ? "border-primary" : "border-transparent hover:border-surface-variant"
                    )}
                  >
                    <img src={img} alt={`Thumbnail ${idx}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Column 2: Product Info */}
          <div className="flex flex-col">
            <p className="text-sm uppercase tracking-[0.2em] text-secondary font-medium mb-2">
              {product.brand || product.category}
            </p>
            <h1 className="headline-lg mb-4">{product.name}</h1>
            
            <div className="flex items-center gap-4 mb-8">
              <span className="text-3xl font-medium">${product.price.toLocaleString()}</span>
              {product.sales && product.sales > 0 ? (
                <span className="px-2 py-1 bg-surface-variant text-on-surface text-xs rounded-full">
                  {product.sales} sold
                </span>
              ) : null}
            </div>
            
            <p className="body-lg text-secondary mb-10 whitespace-pre-line">
              {product.description || "No description available for this product."}
            </p>
            
            {/* Action Area */}
            <div className="mt-auto flex flex-col gap-6">
              
              {/* Quantity Selector */}
              <div>
                <p className="text-sm font-medium mb-3">Quantity</p>
                <div className="flex items-center w-32 bg-surface-variant rounded-full p-1 border border-transparent focus-within:border-primary">
                  <button 
                    onClick={decreaseQuantity}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white transition-colors"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="flex-1 text-center font-medium">{quantity}</span>
                  <button 
                    onClick={increaseQuantity}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <p className="text-xs text-secondary mt-2">
                  {product.stock ? `${product.stock} items available` : 'In stock'}
                </p>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-4">
                <button 
                  onClick={handleAddToCart}
                  className="flex-1 bg-primary text-white h-14 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-primary-container transition-colors shadow-lg shadow-primary/20"
                >
                  <ShoppingBag size={20} />
                  <span>Add to Cart - ${(product.price * quantity).toLocaleString()}</span>
                </button>
                
                <button 
                  onClick={handleWishlistToggle}
                  className={cn(
                    "w-14 h-14 shrink-0 rounded-full flex items-center justify-center transition-all border",
                    inWishlist 
                      ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                      : "bg-white text-on-surface border-surface-variant hover:border-primary hover:text-primary"
                  )}
                >
                  <Heart size={24} className={inWishlist ? "fill-white" : ""} />
                </button>
              </div>
              
              {/* Extras (Delivery, etc.) */}
              <div className="mt-6 pt-6 border-t border-surface-variant/50 flex flex-col gap-3 text-sm text-secondary">
                <p className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  Ships from {product.location || 'Warehouse'}
                </p>
                <p className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  Free standard shipping on orders over $100
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <div className="mt-24 pt-16 border-t border-surface-variant">
            <div className="flex items-center justify-between mb-8">
              <h2 className="headline-md">Related Products</h2>
              <button 
                onClick={() => navigate('/collections')}
                className="text-primary font-medium hover:underline"
              >
                View all
              </button>
            </div>
            <ProductGrid products={relatedProducts} layout="grid-4" />
          </div>
        )}
      </div>
    </div>
  );
}
