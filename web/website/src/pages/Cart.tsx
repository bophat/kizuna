import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Icons } from '@/components/Icons';
import { useCart } from '@/context/CartContext';
import { Plus, Minus, ShoppingBag } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { apiFetch } from '@/lib/api';

export function CartPage() {
  const { cart, removeFromCart, updateQuantity } = useCart();
  const navigate = useNavigate();
  const [productCache, setProductCache] = useState<Record<string, any>>({});

  const handleUpdateQuantity = (productId: string, currentQuantity: number, delta: number) => {
    const newQuantity = currentQuantity + delta;
    if (newQuantity <= 0) {
      removeFromCart(productId);
    } else {
      updateQuantity(productId, newQuantity);
    }
  };

  useEffect(() => {
    if (!localStorage.getItem('access_token')) {
      navigate('/login');
    }
  }, [navigate]);

  // Fetch product details for cart items
  useEffect(() => {
    if (!cart?.items?.length) return;
    const productIds = cart.items.map(i => i.product_id);
    Promise.all(
      productIds.map(id =>
        apiFetch(`/shop/products/${id}/`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    ).then(results => {
      const cache: Record<string, any> = {};
      results.forEach((p, idx) => {
        if (p) cache[productIds[idx]] = p;
      });
      setProductCache(cache);
    });
  }, [cart?.items]);

  const items = cart?.items.map(cartItem => {
    const product = productCache[cartItem.product_id];
    return {
      ...cartItem,
      productDetail: product
        ? { name: product.name, image: product.image, location: product.location }
        : { name: `Product #${cartItem.product_id}`, image: '', location: '' }
    };
  }) || [];

  const subtotal = parseFloat(cart?.total_amount || '0');
  const shipping = 75;
  const total = subtotal > 0 ? subtotal + shipping : 0;

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-12 md:py-16">
      <div className="mb-12">
        <h1 className="headline-xl">Shopping Cart</h1>
        <p className="body-md text-secondary mt-2">{items.length} items in your cart</p>
      </div>

      {items.length === 0 ? (
        <EmptyState 
          icon={<ShoppingBag size={48} />}
          title="Your cart is empty"
          description="Explore our collections to find items you love and add them to your cart."
        />
      ) : (
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Cart Items List */}
          <div className="w-full lg:w-2/3 flex flex-col gap-6">
            <AnimatePresence>
            {items.map((item) => (
              <motion.div
                key={item.product_id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col sm:flex-row gap-8 pb-8 border-b border-surface-variant"
              >
                <div className="w-full sm:w-[200px] aspect-[4/5] bg-surface-container-highest shrink-0 overflow-hidden rounded-sm relative">
                  <img src={item.productDetail.image} alt={item.productDetail.name} className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-col flex-grow justify-between py-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="headline-md font-medium text-lg lg:text-xl">{item.productDetail.name}</h3>
                      <p className="label-sm text-secondary normal-case mt-2">{item.productDetail.location}</p>
                    </div>
                    <span className="headline-md text-lg lg:text-xl">${parseFloat(item.price).toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center mt-8">
                    <div className="flex items-center border border-surface-variant rounded">
                      <button 
                        onClick={() => handleUpdateQuantity(item.product_id, item.quantity, -1)}
                        className="p-2 text-secondary hover:text-on-surface transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="body-md px-4 min-w-[40px] text-center">{item.quantity}</span>
                      <button 
                        onClick={() => handleUpdateQuantity(item.product_id, item.quantity, 1)}
                        className="p-2 text-secondary hover:text-on-surface transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product_id)}
                      className="label-sm text-secondary hover:text-primary transition-colors underline underline-offset-8"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
            </AnimatePresence>
          </div>

          {/* Order Summary */}
          <div className="w-full lg:w-1/3">
            <div className="bg-surface-bright border border-surface-variant p-8 sticky top-32">
              <h2 className="headline-md text-xl mb-6">Order Summary</h2>
              <div className="flex flex-col gap-4 mb-8">
                <div className="flex justify-between body-md text-secondary">
                  <span>Subtotal</span>
                  <span className="text-on-surface">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between body-md text-secondary">
                  <span>Shipping (Japan to Global)</span>
                  <span className="text-on-surface">${subtotal > 0 ? shipping : 0}</span>
                </div>
              </div>
              <div className="flex justify-between headline-md text-xl pt-6 border-t border-surface-variant mb-8">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
              <div className="flex flex-col gap-4">
                {subtotal > 0 && (
                  <Link
                    to="/checkout"
                    className="w-full bg-primary text-white label-md px-4 py-5 rounded-sm hover:opacity-90 transition-all text-center tracking-widest"
                  >
                    Proceed to Checkout
                  </Link>
                )}
                <Link to="/collections" className="w-full text-center label-md text-secondary normal-case tracking-normal hover:text-on-surface transition-colors mt-2">
                  Continue Shopping
                </Link>
              </div>
              <div className="mt-8 pt-8 border-t border-surface-variant flex items-center gap-3 text-secondary">
                <Icons.ShieldCheck size={18} />
                <span className="label-sm normal-case tracking-normal">Secure Checkout Protected</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
