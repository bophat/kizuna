import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { Icons } from '@/components/Icons';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { useFormatPrice } from '@/hooks/useFormatPrice';
import { fadeUp, slideX, tweenBase, tweenFast } from '@/lib/motion';
import { ProductImage } from '@/components/products/ProductImage';
import { getAffiliateCode } from '@/lib/affiliate';

const STEPS = ['information', 'shipping', 'payment', 'success'] as const;

type AppliedCoupon = {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: string;
  subtotal_amount: string;
  discount_amount: string;
  total_after_discount: string;
};

type OwnedCoupon = AppliedCoupon & {
  amount_currency: 'USD' | 'VND';
  discount_value_base: string;
  minimum_order_amount: string;
  maximum_discount_amount: string | null;
  source: 'manual' | 'birthday';
  birthday_year: number | null;
  expires_at: string | null;
  is_applicable: boolean;
  error_code: string | null;
};

type PaymentMethod = {
  code: 'cod' | 'bank_transfer';
  instructions: string;
  currency: string;
  expiry_minutes: number;
};

type InformationFormProps = {
  email: string;
  setEmail: (value: string) => void;
  firstName: string;
  setFirstName: (value: string) => void;
  lastName: string;
  setLastName: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  address: string;
  setAddress: (value: string) => void;
  onNext: () => void;
};

export function CheckoutPage() {
  const { t, i18n } = useTranslation();
  const { format: formatPrice, rates } = useFormatPrice();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);
  const [paymentMethodsError, setPaymentMethodsError] = useState('');
  const [orderData, setOrderData] = useState<any>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productCache, setProductCache] = useState<Record<string, any>>({});
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [ownedCoupons, setOwnedCoupons] = useState<OwnedCoupon[]>([]);
  const [ownedCouponsLoading, setOwnedCouponsLoading] = useState(false);
  const [ownedCouponsError, setOwnedCouponsError] = useState('');
  const [checkoutError, setCheckoutError] = useState('');

  const { cart, fetchCart } = useCart();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const cartCouponSignature = (cart?.items || [])
    .map((item) => `${item.product_id}:${item.quantity}`)
    .join('|');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
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

    if (isAuthenticated) {
      fetchUserData();
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    let cancelled = false;
    setPaymentMethodsLoading(true);
    setPaymentMethodsError('');
    apiFetch('/shop/payment-methods/')
      .then(async (response) => {
        if (!response.ok) throw new Error('payment methods');
        const data = await response.json();
        if (cancelled) return;
        const methods = Array.isArray(data) ? data : [];
        setPaymentMethods(methods);
        setPaymentMethod((current) => (
          methods.some((method: PaymentMethod) => method.code === current)
            ? current
            : methods[0]?.code || ''
        ));
      })
      .catch(() => {
        if (!cancelled) setPaymentMethodsError(t('checkout.payment_methods_error'));
      })
      .finally(() => {
        if (!cancelled) setPaymentMethodsLoading(false);
      });
    return () => { cancelled = true; };
  }, [i18n.language, t]);

  useEffect(() => {
    if (!isAuthenticated || !cartCouponSignature) {
      setOwnedCoupons([]);
      setOwnedCouponsError('');
      return undefined;
    }

    let cancelled = false;
    setOwnedCouponsLoading(true);
    setOwnedCouponsError('');
    apiFetch('/shop/coupons/mine/')
      .then(async (response) => {
        if (!response.ok) throw new Error('owned coupons');
        const data = await response.json();
        if (!cancelled) {
          setOwnedCoupons(Array.isArray(data?.results) ? data.results : []);
        }
      })
      .catch(() => {
        if (!cancelled) setOwnedCouponsError(t('checkout.owned_coupons_error'));
      })
      .finally(() => {
        if (!cancelled) setOwnedCouponsLoading(false);
      });
    return () => { cancelled = true; };
  }, [cartCouponSignature, isAuthenticated, t]);

  const trackedOrderId = orderData?.order?.id;
  const trackedPaymentMethod = orderData?.payment?.method || orderData?.order?.payment?.method;
  const trackedPaymentStatus = orderData?.payment?.status || orderData?.order?.payment?.status;

  useEffect(() => {
    if (
      step !== 3
      || !trackedOrderId
      || trackedPaymentMethod !== 'bank_transfer'
      || !['pending', 'proof_submitted'].includes(trackedPaymentStatus)
    ) {
      return undefined;
    }

    let cancelled = false;
    const refreshOrder = async () => {
      try {
        const response = await apiFetch(`/shop/orders/${trackedOrderId}/`);
        if (!response.ok || cancelled) return;
        const order = await response.json();
        if (cancelled) return;
        setOrderData((current: any) => current ? {
          ...current,
          order,
          payment: order.payment,
        } : current);
      } catch (error) {
        console.error('Error refreshing payment status:', error);
      }
    };

    void refreshOrder();
    const intervalId = window.setInterval(refreshOrder, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [step, trackedOrderId, trackedPaymentMethod, trackedPaymentStatus]);

  const nextStep = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  const couponErrorText = (errorCode: string, minimum?: string) => {
    const key = `checkout.coupon_errors.${errorCode}`;
    return t(key, {
      amount: minimum ? formatPrice(parseFloat(minimum)) : '',
      defaultValue: t('checkout.coupon_errors.invalid'),
    });
  };

  const checkoutErrorText = (data: Record<string, any>) => {
    const errorCode = data.checkout_error_code || data.payment_error_code;
    if (!errorCode) return data.error || t('checkout.errors.failed');
    return t(`checkout.errors.${errorCode}`, {
      product: data.product_name || '',
      count: data.available_stock ?? 0,
      defaultValue: data.error || t('checkout.errors.failed'),
    });
  };

  const applyCoupon = async (selectedCode?: string) => {
    const code = (selectedCode ?? couponCode).trim().toUpperCase();
    if (!code || isApplyingCoupon) return;
    setCouponCode(code);
    setIsApplyingCoupon(true);
    setCouponError('');
    try {
      const response = await apiFetch('/shop/coupons/validate/', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAppliedCoupon(null);
        setCouponError(couponErrorText(data.error_code, data.minimum_order_amount));
        return;
      }
      setCouponCode(data.code);
      setAppliedCoupon(data);
    } catch {
      setAppliedCoupon(null);
      setCouponError(t('checkout.coupon_errors.connection'));
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const handleCheckout = async () => {
    if (isSubmitting || !paymentMethod) return;
    setIsSubmitting(true);
    setCheckoutError('');
    try {
      const response = await apiFetch('/shop/checkout/process_checkout/', {
        method: 'POST',
        body: JSON.stringify({
          email,
          payment_method: paymentMethod,
          first_name: firstName,
          last_name: lastName,
          phone,
          address,
          coupon_code: appliedCoupon?.code || '',
          affiliate_code: getAffiliateCode()
        })
      });
      const data = await response.json();
      if (response.ok) {
        setOrderData(data);

        await fetchCart(); // Refresh cart to empty
        nextStep(); // Go to Success step
      } else {
        if (data.coupon_error_code) {
          const message = couponErrorText(data.coupon_error_code);
          setAppliedCoupon(null);
          setCouponError(message);
          setCheckoutError(message);
        } else {
          setCheckoutError(checkoutErrorText(data));
          if (data.checkout_error_code === 'empty_cart') {
            await fetchCart();
          }
        }
      }
    } catch (error) {
      console.error(error);
      setCheckoutError(t('checkout.errors.connection'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const uploadReceipt = async () => {
    if (!receiptFile || !orderData?.order?.id || receiptUploading) return;
    setReceiptUploading(true);
    setReceiptError('');
    try {
      const body = new FormData();
      body.append('receipt', receiptFile);
      const response = await apiFetch(
        `/shop/orders/${orderData.order.id}/payment-proof/`,
        { method: 'POST', body },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(t('checkout.receipt_upload_error'));
      setOrderData((current: any) => ({
        ...current,
        payment: data,
        order: { ...current.order, payment: data },
      }));
      setReceiptFile(null);
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : t('checkout.receipt_upload_error'));
    } finally {
      setReceiptUploading(false);
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
  }, [cart?.items, i18n.language]);

  const cartSubtotal = parseFloat(cart?.total_amount || '0');
  const subtotal = appliedCoupon
    ? parseFloat(appliedCoupon.subtotal_amount)
    : cartSubtotal;

  const items = cart?.items.map(cartItem => {
    const product = productCache[cartItem.product_id];
    return {
      ...cartItem,
      productDetail: product
        ? { name: product.name, image: product.image, location: product.location }
        : { name: t('product.fallback_name', { id: cartItem.product_id }), image: '', location: '' }
    };
  }) || [];

  const calculateShippingUsd = () => {
    if (!items || items.length === 0) return 0;
    const usdToVnd = rates?.usdToVnd || 25000;
    let shippingVnd = 0;
    items.forEach(item => {
      const product = productCache[item.product_id];
      const weight = product ? parseFloat(product.weight) || 0.3 : 0.3;
      const qty = item.quantity;
      if (weight > 0.5) {
        const roundedWeight = Math.ceil(weight);
        shippingVnd += 180000 * roundedWeight * qty;
      } else {
        shippingVnd += 50000 * qty;
      }
    });
    return shippingVnd / usdToVnd;
  };

  const shipping = calculateShippingUsd();
  const discount = appliedCoupon ? parseFloat(appliedCoupon.discount_amount) : 0;
  const total = subtotal > 0 ? Math.max(0, subtotal + shipping - discount) : 0;

  if (step === 0 && isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (step === 3 && orderData) {
    const orderTotal = parseFloat(orderData.order.total_amount);
    const payment = orderData.payment || orderData.order.payment;
    const isBankTransfer = payment?.method === 'bank_transfer';
    const bankPaymentPaid = isBankTransfer && payment?.status === 'paid';
    const orderCode = orderData.order.order_code || payment?.reference || orderData.order.id;
    const settlementAmount = new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: payment?.settlement_currency || 'VND',
      maximumFractionDigits: 0,
    }).format(Number(payment?.settlement_amount || 0));
    return (
      <div className=" md:py-10 px-4 flex items-center justify-center">
        <motion.div
          {...fadeUp}
          transition={tweenBase}
          className="w-full max-w-2xl bg-zinc-900 rounded-[2.5rem] border border-zinc-800 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden text-white"
        >
          {/* Success Header */}
          <div className="p-1 md:p-1 text-center flex flex-col items-center border-b border-zinc-800">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ ...tweenBase, delay: 0.08 }}
              className="w-15 h-15 md:w-20 md:h-20 bg-green-500 text-white rounded-full flex items-center justify-center mb-6 md:mb-8 shadow-2xl shadow-green-500/30"
            >
              <Icons.Check size={40} className="md:w-12 md:h-12" />
            </motion.div>

            <h1 className="text-xl md:text-2xl font-black text-white mb-4 tracking-tight leading-tight">
              {t(
                bankPaymentPaid
                  ? 'checkout.bank_paid_title'
                  : isBankTransfer
                    ? 'checkout.bank_pending_title'
                    : 'checkout.success_title'
              )}
            </h1>
            <p className="text-base md:text-lg text-zinc-400 leading-relaxed max-w-2xl mx-auto">
              {t(
                bankPaymentPaid
                  ? 'checkout.bank_paid_message'
                  : isBankTransfer
                    ? 'checkout.bank_pending_message'
                    : 'checkout.success_message',
                { id: orderCode },
              )} <br className="hidden md:block" />
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
                  <p className="text-3xl md:text-4xl font-black text-black tracking-tighter">{settlementAmount}</p>
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
                      <img src={orderData.bank_details.qr_code_url} alt={t('checkout.bank_qr_alt')} className="w-40 h-40 md:w-48 md:h-48" />
                    </div>
                    <p className="text-xs text-zinc-500 italic text-center">{t('checkout.scan_to_pay')}</p>
                  </div>
                )}

                <div className="rounded-2xl border border-zinc-700 bg-zinc-800 p-5 text-sm text-zinc-200 space-y-2">
                  <p><span className="text-zinc-500">{t('checkout.payment_reference')}:</span> <strong className="font-mono text-white">{payment?.reference}</strong></p>
                  {payment?.expires_at && <p><span className="text-zinc-500">{t('checkout.payment_expires')}:</span> {new Date(payment.expires_at).toLocaleString(i18n.language)}</p>}
                  {payment?.bank_details?.instructions && <p className="whitespace-pre-wrap text-zinc-300">{payment.bank_details.instructions}</p>}
                </div>

                <div className="rounded-2xl border border-zinc-700 bg-zinc-800 p-5 space-y-4">
                  <div>
                    <h3 className="font-bold text-white">{t('checkout.upload_receipt')}</h3>
                    <p className="mt-1 text-xs text-zinc-400">{t('checkout.upload_receipt_help')}</p>
                  </div>
                  {payment?.status === 'proof_submitted' ? (
                    <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-300">{t('checkout.receipt_submitted')}</p>
                  ) : payment?.status === 'paid' ? (
                    <p className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-300">{t('checkout.payment_verified')}</p>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                          setReceiptFile(event.target.files?.[0] || null);
                          setReceiptError('');
                        }}
                        className="min-w-0 flex-1 rounded-xl border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"
                      />
                      <button
                        onClick={() => void uploadReceipt()}
                        disabled={!receiptFile || receiptUploading}
                        className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {receiptUploading ? t('checkout.uploading_receipt') : t('checkout.submit_receipt')}
                      </button>
                    </div>
                  )}
                  {receiptError && <p className="text-sm text-red-400">{receiptError}</p>}
                </div>
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
                    <p className="text-base md:text-lg font-bold text-white">{formatPrice(orderTotal)}</p>
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
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              {...slideX}
              transition={tweenFast}
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
              {step === 1 && <ShippingMethodForm email={email} onNext={nextStep} onPrev={prevStep} shipping={shipping} />}
              {step === 2 && <PaymentMethodForm isSubmitting={isSubmitting} paymentMethod={paymentMethod} paymentMethods={paymentMethods} loading={paymentMethodsLoading} error={paymentMethodsError} checkoutError={checkoutError} setPaymentMethod={(value) => { setPaymentMethod(value); setCheckoutError(''); }} onPrev={prevStep} onSubmit={handleCheckout} />}
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
                    <ProductImage
                      src={item.productDetail.image}
                      alt={item.productDetail.name}
                      preset="cart"
                      className="h-full w-full"
                    />
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-[10px] label-sm font-bold shadow-lg">{item.quantity}</span>
                  </div>
                  <div className="flex-grow">
                    <h4 className="label-md normal-case tracking-normal line-clamp-1 text-zinc-100">{item.productDetail.name}</h4>
                  </div>
                  <span className="label-md shrink-0 text-white">{formatPrice(item.price)}</span>
                </div>
              ))}
            </div>

            <div className="mb-6 border-t border-zinc-800 pt-6">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {t('checkout.coupon_label')}
              </label>
              {appliedCoupon ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-emerald-300">{appliedCoupon.code}</p>
                    <p className="mt-0.5 text-xs text-emerald-400/80">
                      {t('checkout.coupon_savings', { amount: formatPrice(discount) })}
                    </p>
                  </div>
                  <button onClick={removeCoupon} className="text-xs font-semibold text-zinc-400 underline underline-offset-4 hover:text-white">
                    {t('checkout.coupon_remove')}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={couponCode}
                    onChange={(event) => {
                      setCouponCode(event.target.value.toUpperCase());
                      setCouponError('');
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void applyCoupon();
                      }
                    }}
                    placeholder={t('checkout.coupon_placeholder')}
                    className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm uppercase text-white outline-none transition placeholder:normal-case placeholder:text-zinc-600 focus:border-primary"
                  />
                  <button
                    onClick={() => void applyCoupon()}
                    disabled={!couponCode.trim() || isApplyingCoupon}
                    className="rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-zinc-900 transition hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isApplyingCoupon ? t('checkout.coupon_applying') : t('checkout.coupon_apply')}
                  </button>
                </div>
              )}
              {couponError && <p className="mt-2 text-xs leading-relaxed text-red-400">{couponError}</p>}
              {(ownedCouponsLoading || ownedCouponsError || ownedCoupons.length > 0) && (
                <div className="mt-5 border-t border-zinc-800 pt-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      {t('checkout.owned_coupons_title')}
                    </p>
                    {ownedCoupons.length > 0 && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {ownedCoupons.length}
                      </span>
                    )}
                  </div>
                  {ownedCouponsLoading ? (
                    <p className="text-xs text-zinc-500">{t('checkout.owned_coupons_loading')}</p>
                  ) : ownedCouponsError ? (
                    <p className="text-xs leading-relaxed text-red-400">{ownedCouponsError}</p>
                  ) : (
                    <div className="max-h-52 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                      {ownedCoupons.map((coupon) => {
                        const selected = appliedCoupon?.code === coupon.code;
                        const minimumText = coupon.minimum_order_amount
                          ? formatPrice(parseFloat(coupon.minimum_order_amount))
                          : '';
                        const maximumText = coupon.maximum_discount_amount
                          ? formatPrice(parseFloat(coupon.maximum_discount_amount))
                          : '';
                        return (
                          <button
                            key={coupon.code}
                            type="button"
                            disabled={!coupon.is_applicable || selected || isApplyingCoupon}
                            onClick={() => void applyCoupon(coupon.code)}
                            className={cn(
                              'w-full rounded-xl border px-3 py-3 text-left transition',
                              selected
                                ? 'border-emerald-500/40 bg-emerald-500/10'
                                : coupon.is_applicable
                                  ? 'border-zinc-700 bg-zinc-800/70 hover:border-primary hover:bg-primary/10'
                                  : 'cursor-not-allowed border-zinc-800 bg-zinc-900/60 opacity-60',
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-mono text-sm font-bold text-white">{coupon.code}</p>
                                <p className="mt-1 text-xs font-semibold text-primary">
                                  {coupon.discount_type === 'percentage'
                                    ? t('checkout.owned_coupon_percent', { percent: Number(coupon.discount_value) })
                                    : t('checkout.owned_coupon_fixed', { amount: formatPrice(parseFloat(coupon.discount_value_base)) })}
                                </p>
                              </div>
                              <span className={cn(
                                'shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold',
                                selected
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : coupon.is_applicable
                                    ? 'bg-white text-zinc-900'
                                    : 'bg-zinc-800 text-zinc-500',
                              )}>
                                {t(
                                  selected
                                    ? 'checkout.owned_coupon_selected'
                                    : coupon.is_applicable
                                      ? 'checkout.owned_coupon_select'
                                      : 'checkout.owned_coupon_unavailable',
                                )}
                              </span>
                            </div>
                            <div className="mt-2 space-y-1 text-[11px] leading-relaxed text-zinc-500">
                              {Number(coupon.minimum_order_amount) > 0 && (
                                <p>{t('checkout.owned_coupon_minimum', { amount: minimumText })}</p>
                              )}
                              {coupon.maximum_discount_amount && (
                                <p>{t('checkout.owned_coupon_maximum', { amount: maximumText })}</p>
                              )}
                              {!coupon.expires_at && <p>{t('checkout.owned_coupon_no_expiry')}</p>}
                              {!coupon.is_applicable && coupon.error_code && (
                                <p className="text-amber-400">
                                  {couponErrorText(coupon.error_code, coupon.minimum_order_amount)}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-zinc-800 pt-6 flex flex-col gap-3 mb-8">
              <div className="flex justify-between body-md text-zinc-400">
                <span>{t('cart.subtotal')}</span>
                <span className="text-white">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between body-md text-zinc-400">
                <span>{t('cart.shipping')}</span>
                <span className="text-white">{formatPrice(shipping)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between body-md text-emerald-400">
                  <span>{t('checkout.coupon_discount')}</span>
                  <span>-{formatPrice(discount)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-zinc-800 pt-6 flex justify-between items-baseline">
              <span className="headline-md text-white">{t('cart.total')}</span>
              <div className="text-right">
                <span className="label-sm text-zinc-500 mr-2">VND</span>
                <span className="headline-lg text-white">{formatPrice(total)}</span>
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
              placeholder={t('checkout.first_name')}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="label-sm text-secondary">{t('checkout.last_name')} *</label>
            <input
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full bg-white border border-surface-variant rounded-sm px-4 py-3 body-md outline-none focus:border-primary transition-colors"
              placeholder={t('checkout.last_name')}

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

function ShippingMethodForm({ email, onNext, onPrev, shipping }: { email: string, onNext: () => void, onPrev: () => void, shipping: number }) {
  const { t } = useTranslation();
  const { format: formatPrice } = useFormatPrice();
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
            <span className="label-md">{formatPrice(shipping)}</span>
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

function PaymentMethodForm({ isSubmitting, paymentMethod, paymentMethods, loading, error, checkoutError, setPaymentMethod, onPrev, onSubmit }: { isSubmitting: boolean, paymentMethod: string, paymentMethods: PaymentMethod[], loading: boolean, error: string, checkoutError: string, setPaymentMethod: (v: string) => void, onPrev: () => void, onSubmit: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-10">
      <div>
        <h2 className="headline-lg">{t('checkout.payment_method')}</h2>
        <p className="body-md text-secondary mt-2">{t('checkout.secure_payment_desc')}</p>
      </div>

      <div className="flex flex-col border border-surface-variant rounded-sm bg-white overflow-hidden">
        {loading && <p className="p-6 text-secondary">{t('checkout.loading_payment_methods')}</p>}
        {!loading && error && <p className="p-6 text-red-600">{error}</p>}
        {!loading && !error && paymentMethods.length === 0 && <p className="p-6 text-red-600">{t('checkout.no_payment_methods')}</p>}
        {paymentMethods.map((method, index) => (
          <label
            key={method.code}
            className={cn(
              "p-6 flex justify-between items-start cursor-pointer transition-colors",
              index < paymentMethods.length - 1 && "border-b border-surface-variant",
              paymentMethod === method.code ? "bg-surface-container-low" : "hover:bg-surface-container-lowest",
            )}
            onClick={() => setPaymentMethod(method.code)}
          >
            <div className="flex items-start gap-4">
              <div className={cn("mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center", paymentMethod === method.code ? "border-primary" : "border-outline")}>
                {paymentMethod === method.code && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
              </div>
              <div>
                <span className="label-md">{t(`checkout.${method.code}`)}</span>
                {method.instructions && <p className="mt-1 whitespace-pre-wrap text-sm text-secondary">{method.instructions}</p>}
              </div>
            </div>
            {method.code === 'cod' ? <Icons.Banknote size={18} className="text-secondary" /> : <Icons.Landmark size={18} className="text-secondary" />}
          </label>
        ))}
      </div>

      {checkoutError && (
        <div role="alert" className="rounded-sm border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-700">
          <div className="flex items-start gap-3">
            <Icons.AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">{checkoutError}</p>
              <Link to="/cart" className="mt-2 inline-block font-semibold underline underline-offset-4">
                {t('checkout.review_cart')}
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse md:flex-row justify-between items-center pt-8 border-t border-surface-variant gap-4">
        <button onClick={onPrev} className="flex items-center gap-2 label-sm text-secondary hover:text-on-surface transition-colors">
          <Icons.ArrowLeft size={16} />
          {t('checkout.steps.shipping')}
        </button>
        <button
          onClick={onSubmit}
          disabled={isSubmitting || loading || Boolean(error) || !paymentMethod}
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
