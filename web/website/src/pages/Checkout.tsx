import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { Icons } from '@/components/Icons';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import { apiFetch } from '@/lib/api';

const STEPS = ['Information', 'Shipping', 'Payment', 'Success'];

export function CheckoutPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [orderData, setOrderData] = useState<any>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productCache, setProductCache] = useState<Record<string, any>>({});

  const { cart, fetchCart } = useCart();

  useEffect(() => {
    if (!localStorage.getItem('access_token')) {
      navigate('/login');
      return;
    }

    const fetchUserData = async () => {
      try {
        const response = await apiFetch('/shop/me/');
        if (response.ok) {
          const data = await response.json();
          setEmail(data.email || '');
          setFirstName(data.first_name || '');
          setLastName(data.last_name || '');
          setPhone(data.profile?.phone || '');
          setAddress(data.profile?.address || '');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoadingUser(false);
      }
    };
    fetchUserData();
  }, []);

  const nextStep = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleCheckout = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const response = await apiFetch('/shop/checkout/process_checkout/', {
        method: 'POST',
        body: JSON.stringify({
          email,
          payment_method: paymentMethod,
          first_name: firstName,
          last_name: lastName,
          phone,
          address
        })
      });
      const data = await response.json();
      if (response.ok) {
        setOrderData(data);
        await fetchCart(); // Refresh cart to empty
        nextStep(); // Go to Success step
      } else {
        alert(data.error || 'Failed to checkout');
      }
    } catch (error) {
      console.error(error);
      alert('Checkout error');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const subtotal = parseFloat(cart?.total_amount || '0');
  const shipping = 75;
  const total = subtotal > 0 ? subtotal + shipping : 0;

  const items = cart?.items.map(cartItem => {
    const product = productCache[cartItem.product_id];
    return {
      ...cartItem,
      productDetail: product
        ? { name: product.name, image: product.image, location: product.location }
        : { name: `Product #${cartItem.product_id}`, image: '', location: '' }
    };
  }) || [];

  if (step === 0 && isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (step === 3 && orderData) {
    const orderTotal = parseFloat(orderData.order.total_amount);
    return (
      <div className=" md:py-10 px-4 flex items-center justify-center">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-2xl bg-zinc-900 rounded-[2.5rem] border border-zinc-800 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden text-white"
        >
          {/* Success Header */}
          <div className="p-1 md:p-1 text-center flex flex-col items-center border-b border-zinc-800">
            <motion.div
              initial={{ scale: 0.1, opacity: 0 }}
              animate={{ scale: 0.5, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 100 }}
              className="w-15 h-15 md:w-20 md:h-20 bg-green-500 text-white rounded-full flex items-center justify-center mb-6 md:mb-8 shadow-2xl shadow-green-500/30"
            >
              <Icons.Check size={40} className="md:w-12 md:h-12" />
            </motion.div>

            <h1 className="text-xl md:text-2xl font-black text-white mb-4 tracking-tight leading-tight">
              {t('checkout.success_title')}
            </h1>
            <p className="text-base md:text-lg text-zinc-400 leading-relaxed max-w-2xl mx-auto">
              {t('checkout.success_message', { id: orderData.order.id })} <br className="hidden md:block" />
              {t('checkout.invoice_sent', { email: email })}
            </p>
          </div>

          {/* Action Area or Bank Details */}
          <div className="p-8 md:p-12">
            {orderData.bank_details ? (
              <div className="space-y-8">
                <div className="bg-white rounded-xl md:rounded-2xl p-6 md:p-8 border border-primary/20 text-center">
                  <div className="flex items-center justify-center gap-2 text-primary mb-2">
                    <Icons.Landmark size={18} />
                    <span className="text-[10px] md:label-sm uppercase tracking-widest font-bold">{t('checkout.bank_details_title')}</span>
                  </div>
                  <p className="text-3xl md:text-4xl font-black text-black tracking-tighter">${orderTotal.toFixed(2)}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">{t('checkout.bank')}</p>
                    <p className="text-base md:text-lg font-bold text-zinc-900 dark:text-zinc-50">{orderData.bank_details.bank_name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">{t('checkout.account_name')}</p>
                    <p className="text-base md:text-lg font-bold text-zinc-900 dark:text-zinc-50 uppercase">{orderData.bank_details.account_name}</p>
                  </div>
                  <div className="col-span-1 md:col-span-2 space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">{t('checkout.account_number')}</p>
                    <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800 p-4 md:p-5 rounded-xl md:rounded-2xl border border-zinc-100 dark:border-zinc-700 overflow-hidden">
                      <p className="text-xl md:text-2xl font-mono font-bold text-zinc-900 dark:text-zinc-50 tracking-widest flex-grow truncate">
                        {orderData.bank_details.account_number}
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(orderData.bank_details.account_number);
                          alert(t('checkout.copied'));
                        }}
                        className="p-3 bg-white dark:bg-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-600 rounded-xl transition-all text-primary shadow-sm border border-zinc-200 dark:border-zinc-600 shrink-0"
                      >
                        <Icons.Copy size={18} />
                      </button>
                    </div>
                  </div>
                </div>

                {orderData.bank_details.qr_code_url && (
                  <div className="flex flex-col items-center gap-4 pt-4">
                    <div className="p-4 bg-white rounded-2xl md:rounded-3xl shadow-xl border border-zinc-100">
                      <img src={orderData.bank_details.qr_code_url} alt="Bank QR" className="w-40 h-40 md:w-48 md:h-48" />
                    </div>
                    <p className="text-xs text-zinc-500 italic text-center">{t('checkout.scan_to_pay')}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1 md:space-y-2">
                <div className="bg-zinc-800 rounded-xl md:rounded-xl p-1 md:p-3 border border-zinc-700 flex items-center justify-between">
                  <div>
                    <p className="text-xs md:label-sm text-zinc-500">{t('checkout.payment_method')}</p>
                    <p className="text-base md:text-lg font-bold text-white">{t('checkout.cod')}</p>
                  </div>
                  <Icons.Banknote size={28} className="text-primary md:w-8 md:h-8" />
                </div>
                <div className="bg-zinc-800 rounded-xl md:rounded-xl p-3 md:p-4 border border-zinc-700 flex items-center justify-between">
                  <div>
                    <p className="text-xs md:label-sm text-zinc-500">{t('checkout.total_amount')}</p>
                    <p className="text-base md:text-lg font-bold text-white">${orderTotal.toFixed(2)}</p>
                  </div>
                  <Icons.ShoppingBag size={28} className="text-primary md:w-8 md:h-8" />
                </div>
              </div>
            )}

            <div className="mt-8 md:mt-10 flex flex-col gap-3">
              <Link to="/order-history" className="w-full bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-center py-3.5 md:py-4 rounded-xl label-md font-bold hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 shadow-xl shadow-zinc-900/10 dark:shadow-zinc-50/10">
                {t('checkout.view_history')}
              </Link>
              <Link to="/collections" className="w-full text-center py-3 md:py-3.5 rounded-xl label-md font-bold text-secondary hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300">
                {t('cart.continue_shopping')}
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }


  return (
    <div className="max-w-[1280px] mx-auto px-8 py-12">
      <nav className="flex items-center gap-2 label-sm text-secondary mb-12 overflow-x-auto whitespace-nowrap pb-2">
        <Link to="/cart" className="hover:text-primary transition-colors">{t('nav.cart')}</Link>
        <Icons.ChevronRight size={14} />
        {STEPS.slice(0, 3).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={cn(
              "transition-all",
              step === i ? "text-on-surface font-bold" : "text-tertiary",
              step < i && "opacity-50"
            )}>
              {t(`checkout.steps.${s.toLowerCase()}` as any)}
            </span>
            {i < 2 && <Icons.ChevronRight size={14} />}
          </div>
        ))}
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24">
        {/* Main Form Area */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {step === 0 && (
                <InformationForm
                  email={email} setEmail={setEmail}
                  firstName={firstName} setFirstName={setFirstName}
                  lastName={lastName} setLastName={setLastName}
                  phone={phone} setPhone={setPhone}
                  address={address} setAddress={setAddress}
                  onNext={nextStep}
                />
              )}
              {step === 1 && <ShippingMethodForm email={email} onNext={nextStep} onPrev={prevStep} />}
              {step === 2 && <PaymentMethodForm isSubmitting={isSubmitting} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} onPrev={prevStep} onSubmit={handleCheckout} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Sidebar Summary */}
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-32 bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] text-white">
            <h2 className="headline-md text-xl mb-8 text-white">{t('cart.order_summary')}</h2>
            <div className="flex flex-col gap-6 mb-8 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {items.map((item, i) => (
                <div key={i} className="flex gap-4 items-center">
                  <div className="relative h-20 w-16 bg-zinc-800 overflow-hidden rounded-xl shrink-0 border border-zinc-700">
                    <img src={item.productDetail.image} alt={item.productDetail.name} className="h-full w-full object-cover" />
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-[10px] label-sm font-bold shadow-lg">{item.quantity}</span>
                  </div>
                  <div className="flex-grow">
                    <h4 className="label-md normal-case tracking-normal line-clamp-1 text-zinc-100">{item.productDetail.name}</h4>
                  </div>
                  <span className="label-md shrink-0 text-white">${parseFloat(item.price).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-zinc-800 pt-6 flex flex-col gap-3 mb-8">
              <div className="flex justify-between body-md text-zinc-400">
                <span>{t('cart.subtotal')}</span>
                <span className="text-white">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between body-md text-zinc-400">
                <span>{t('cart.shipping')}</span>
                <span className="text-white">${shipping.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-6 flex justify-between items-baseline">
              <span className="headline-md text-white">{t('cart.total')}</span>
              <div className="text-right">
                <span className="label-sm text-zinc-500 mr-2">USD</span>
                <span className="headline-lg text-white">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InformationForm({
  email, setEmail,
  firstName, setFirstName,
  lastName, setLastName,
  phone, setPhone,
  address, setAddress,
  onNext
}: InformationFormProps) {
  const { t } = useTranslation();
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !firstName || !lastName || !phone || !address) {
      alert(t('checkout.fill_required'));
      return;
    }
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-10">
      <section>
        <div className="flex justify-between items-end mb-6">
          <h2 className="headline-md">{t('checkout.contact_info')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="label-sm text-secondary">{t('auth.email')} *</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border border-surface-variant rounded-sm px-4 py-3 body-md outline-none focus:border-primary transition-colors"
              placeholder="email@example.com"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="label-sm text-secondary">{t('users.phone')} *</label>
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-white border border-surface-variant rounded-sm px-4 py-3 body-md outline-none focus:border-primary transition-colors"
              placeholder="090..."
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="headline-md">{t('checkout.shipping_address')}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="label-sm text-secondary">{t('checkout.first_name')} *</label>
            <input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full bg-white border border-surface-variant rounded-sm px-4 py-3 body-md outline-none focus:border-primary transition-colors"
              placeholder="First Name"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="label-sm text-secondary">{t('checkout.last_name')} *</label>
            <input
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full bg-white border border-surface-variant rounded-sm px-4 py-3 body-md outline-none focus:border-primary transition-colors"
              placeholder="Last Name"

            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="label-sm text-secondary">{t('checkout.address')} *</label>
          <input
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full bg-white border border-surface-variant rounded-sm px-4 py-3 body-md outline-none focus:border-primary transition-colors"
            placeholder={t('checkout.address_placeholder')}
          />
        </div>
      </section>

      <div className="flex flex-col-reverse md:flex-row justify-between items-center pt-8 border-t border-surface-variant gap-4">
        <Link to="/cart" className="flex items-center gap-2 label-sm text-secondary hover:text-on-surface transition-colors">
          <Icons.ArrowLeft size={16} />
          {t('checkout.return_to_cart')}
        </Link>
        <button
          type="submit"
          className="w-full md:w-auto bg-primary text-white label-md px-12 py-4 rounded-sm hover:-translate-y-0.5 active:scale-[0.98] hover:shadow-lg hover:shadow-primary/20 transition-all duration-300"
        >
          {t('checkout.continue_to_shipping')}
        </button>
      </div>
    </form>
  );
}

function ShippingMethodForm({ email, onNext, onPrev }: { email: string, onNext: () => void, onPrev: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-10">
      <h2 className="headline-lg">{t('checkout.steps.shipping')}</h2>

      <div className="border border-surface-variant rounded-sm overflow-hidden bg-white">
        <div className="flex flex-col md:flex-row p-6 border-b border-surface-variant gap-4">
          <span className="label-md text-tertiary w-32 border-none">{t('checkout.contact')}</span>
          <span className="body-md flex-grow">{email || 'guest@example.com'}</span>
          <button onClick={onPrev} className="label-sm text-primary underline underline-offset-8">{t('checkout.change')}</button>
        </div>
      </div>

      <section className="flex flex-col gap-6">
        <h3 className="headline-md">{t('checkout.select_method')}</h3>
        <div className="flex flex-col border border-surface-variant rounded-sm bg-white overflow-hidden">
          <label className="flex items-center justify-between p-6 cursor-pointer transition-colors border-surface-variant bg-surface-container-low">
            <div className="flex items-center gap-4">
              <div className="w-5 h-5 rounded-full border border-primary flex items-center justify-center transition-all">
                <div className="w-2.5 h-2.5 bg-primary rounded-full transition-all" />
              </div>
              <div>
                <p className="label-md lowercase tracking-tight text-on-surface">{t('checkout.standard_shipping')}</p>
                <p className="label-sm text-tertiary mt-1 tracking-normal normal-case">{t('checkout.est_delivery')}</p>
              </div>
            </div>
            <span className="label-md">$75.00</span>
          </label>
        </div>
      </section>

      <div className="flex flex-col-reverse md:flex-row justify-between items-center pt-8 border-t border-surface-variant gap-4">
        <button onClick={onPrev} className="flex items-center gap-2 label-sm text-secondary hover:text-on-surface transition-colors">
          <Icons.ArrowLeft size={16} />
          {t('checkout.return_to_info')}
        </button>
        <button
          onClick={onNext}
          className="w-full md:w-auto bg-primary text-white label-md px-12 py-4 rounded-sm hover:-translate-y-0.5 active:scale-[0.98] hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 font-bold"
        >
          {t('checkout.continue_to_payment')}
        </button>
      </div>
    </div>
  );
}

function PaymentMethodForm({ isSubmitting, paymentMethod, setPaymentMethod, onPrev, onSubmit }: { isSubmitting: boolean, paymentMethod: string, setPaymentMethod: (v: string) => void, onPrev: () => void, onSubmit: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-10">
      <div>
        <h2 className="headline-lg">{t('checkout.payment_method')}</h2>
        <p className="body-md text-secondary mt-2">{t('checkout.secure_payment_desc')}</p>
      </div>

      <div className="flex flex-col border border-surface-variant rounded-sm bg-white overflow-hidden">
        {/* Cash on Delivery */}
        <label
          className={cn(
            "p-6 flex justify-between items-center cursor-pointer transition-colors border-b border-surface-variant",
            paymentMethod === 'cash' ? "bg-surface-container-low" : "hover:bg-surface-container-lowest"
          )}
          onClick={() => setPaymentMethod('cash')}
        >
          <div className="flex items-center gap-4">
            <div className={cn("w-5 h-5 rounded-full border flex items-center justify-center", paymentMethod === 'cash' ? "border-primary" : "border-outline")}>
              {paymentMethod === 'cash' && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
            </div>
            <span className="label-md">{t('checkout.cod')}</span>
          </div>
          <Icons.Banknote size={18} className="text-secondary" />
        </label>

        {/* Bank Transfer */}
        <label
          className={cn(
            "p-6 flex items-center justify-between cursor-pointer transition-colors",
            paymentMethod === 'bank_transfer' ? "bg-surface-container-low" : "hover:bg-surface-container-lowest"
          )}
          onClick={() => setPaymentMethod('bank_transfer')}
        >
          <div className="flex items-center gap-4">
            <div className={cn("w-5 h-5 rounded-full border flex items-center justify-center", paymentMethod === 'bank_transfer' ? "border-primary" : "border-outline")}>
              {paymentMethod === 'bank_transfer' && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
            </div>
            <span className="label-md">{t('checkout.bank_transfer')}</span>
          </div>
          <Icons.Landmark size={18} className="text-secondary" />
        </label>
      </div>

      <div className="flex flex-col-reverse md:flex-row justify-between items-center pt-8 border-t border-surface-variant gap-4">
        <button onClick={onPrev} className="flex items-center gap-2 label-sm text-secondary hover:text-on-surface transition-colors">
          <Icons.ArrowLeft size={16} />
          {t('checkout.steps.shipping')}
        </button>
        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          className={cn(
            "w-full md:w-auto bg-primary text-white label-md px-16 py-4 rounded-sm transition-all duration-300 flex items-center justify-center gap-2",
            isSubmitting ? "opacity-70 cursor-not-allowed" : "hover:-translate-y-0.5 active:scale-[0.98] hover:shadow-lg hover:shadow-primary/20"
          )}
        >
          {isSubmitting && <Icons.Loader2 className="animate-spin" size={18} />}
          {isSubmitting ? t('checkout.processing') : t('checkout.place_order')}
        </button>
      </div>

      <div className="text-center text-secondary label-sm normal-case tracking-normal py-4">
        <Icons.ShieldCheck size={14} className="inline mr-2" />
        {t('checkout.secure_transaction')}
      </div>
    </div>
  );
}
