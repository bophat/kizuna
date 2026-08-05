import React, { useState, useEffect } from 'react';
import { Icons } from '@/components/Icons';
import { CircleAlert, Copy, Loader2, Package, Star, LogOut, CheckCircle2, KeyRound, Link2, MousePointerClick, WalletCards } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/EmptyState';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { ProductImage } from '@/components/products/ProductImage';
import { useFormatPrice } from '@/hooks/useFormatPrice';

interface OrderItem {
  id: number;
  product_id: string;
  product_name: string;
  quantity: number;
  price: string;
  image: string | null;
}

interface Order {
  id: number;
  order_code: string;
  status: string;
  payment_method: string;
  total_amount: string;
  items: OrderItem[];
  created_at: string;
}

interface UserProfile {
  phone: string;
  address: string;
  points: number;
}

interface UserData {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  profile: UserProfile;
}

interface AffiliateDashboard {
  is_affiliate: boolean;
  code?: string;
  status?: string;
  commission_rate?: string;
  cookie_days?: number;
  visits_count?: number;
  orders_count?: number;
  totals?: Record<'pending' | 'available' | 'paid' | 'reversed', string>;
  recent_commissions?: Array<{
    id: number;
    order_id: number;
    status: string;
    base_amount: string;
    amount: string;
    created_at: string;
  }>;
}

interface LoyaltyTransaction {
  id: number;
  order_id: number;
  points_delta: number;
  balance_after: number;
  reason: 'order_delivered' | 'order_reversed';
  created_at: string;
}

interface LoyaltyDashboard {
  points: number;
  transactions: LoyaltyTransaction[];
}



export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { format: formatPrice } = useFormatPrice();
  const [activeTab, setActiveTab] = useState<'info' | 'orders' | 'items' | 'loyalty' | 'affiliate'>('info');
  const [user, setUser] = useState<UserData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSendingPasswordEmail, setIsSendingPasswordEmail] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [affiliate, setAffiliate] = useState<AffiliateDashboard | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyDashboard | null>(null);
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    fetchProfile();
    fetchOrders();
    fetchAffiliate();
    fetchLoyalty();
  }, [i18n.language]);

  const fetchProfile = async () => {
    try {
      const res = await apiFetch('/shop/me/');
      if (res.status === 401) {
        navigate('/login');
        return;
      }
      const data = await res.json();
      setUser(data);
      setFormData({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
        phone: data.profile?.phone || '',
        address: data.profile?.address || ''
      });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await apiFetch('/shop/orders/');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAffiliate = async () => {
    try {
      const response = await apiFetch('/shop/affiliates/me/');
      if (response.ok) setAffiliate(await response.json());
    } catch (error) {
      console.error(error);
    }
  };

  const fetchLoyalty = async () => {
    try {
      const response = await apiFetch('/shop/loyalty/');
      if (response.ok) setLoyalty(await response.json());
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setMessage(null);
    try {
      const res = await apiFetch('/shop/me/', {
        method: 'PATCH',
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        const updatedUser = await res.json();
        setUser(updatedUser);
        setMessage({ type: 'success', text: t('profile.update_success') });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: t('profile.update_error') });
      }
    } catch (err) {
      setMessage({ type: 'error', text: t('common.error') });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handlePasswordChangeRequest = async () => {
    setIsSendingPasswordEmail(true);
    setPasswordMessage(null);
    try {
      const response = await apiFetch('/password-change/request/', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setPasswordMessage({ type: 'success', text: t('profile.change_password_sent') });
      } else if (response.status === 404) {
        setPasswordMessage({ type: 'error', text: t('profile.change_password_unavailable') });
      } else if (response.status === 429) {
        setPasswordMessage({ type: 'error', text: t('profile.change_password_rate_limited') });
      } else if (response.status === 401) {
        await logout();
        navigate('/login');
      } else {
        setPasswordMessage({
          type: 'error',
          text: data.code === 'password_email_missing'
            ? t('profile.change_password_email_missing')
            : t('profile.change_password_failed'),
        });
      }
    } catch {
      setPasswordMessage({ type: 'error', text: t('common.error_connection') });
    } finally {
      setIsSendingPasswordEmail(false);
    }
  };

  // Get all unique purchased items from orders
  const purchasedItems = orders.reduce((acc: OrderItem[], order) => {
    order.items.forEach(item => {
      if (!acc.find(i => i.product_id === item.product_id)) {
        acc.push(item);
      }
    });
    return acc;
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="body-sm text-secondary">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-12 md:py-16">
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h1 className="headline-xl">{t('profile.title')}</h1>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/5 border border-primary/10 rounded-full">
              <Star size={14} className="text-primary fill-primary" />
              <span className="label-sm text-primary font-bold">{t('profile.points', { count: loyalty?.points ?? user?.profile?.points ?? 0 })}</span>
            </div>
          </div>
          <p className="body-md text-secondary max-w-2xl">
            {t('profile.welcome_back', { name: user?.first_name || user?.username })}
          </p>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-secondary hover:text-red-500 transition-colors label-md tracking-normal lowercase"
        >
          <LogOut size={18} />
          {t('profile.sign_out')}
        </button>
      </header>

      {/* Tabs Navigation */}
      <div className="flex border-b border-surface-variant mb-10 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('info')}
          className={`px-8 py-4 label-md tracking-normal border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'info' ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          {t('profile.personal_info')}
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-8 py-4 label-md tracking-normal border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'orders' ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          {t('profile.order_history_count', { count: orders.length })}
        </button>
        <button
          onClick={() => setActiveTab('items')}
          className={`px-8 py-4 label-md tracking-normal border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'items' ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          {t('profile.purchased_items', { count: purchasedItems.length })}
        </button>
        <button
          onClick={() => setActiveTab('loyalty')}
          className={`px-8 py-4 label-md tracking-normal border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'loyalty' ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          {t('profile.loyalty.tab')}
        </button>
        {affiliate?.is_affiliate && (
          <button
            onClick={() => setActiveTab('affiliate')}
            className={`px-8 py-4 label-md tracking-normal border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'affiliate' ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            {t('affiliate_dashboard.tab')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-12">
          {activeTab === 'info' && (
            <div className="max-w-3xl">
              <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="label-sm text-secondary lowercase">{t('profile.first_name')}</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full bg-surface-container border border-surface-variant p-4 body-md focus:border-primary outline-none transition-all rounded-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="label-sm text-secondary lowercase">{t('profile.last_name')}</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full bg-surface-container border border-surface-variant p-4 body-md focus:border-primary outline-none transition-all rounded-sm"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="label-sm text-secondary lowercase">{t('auth.email')}</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-surface-container border border-surface-variant p-4 body-md focus:border-primary outline-none transition-all rounded-sm"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="label-sm text-secondary lowercase">{t('profile.phone')}</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-surface-container border border-surface-variant p-4 body-md focus:border-primary outline-none transition-all rounded-sm"
                    placeholder={t('profile.phone_placeholder')}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="label-sm text-secondary lowercase">{t('profile.default_address')}</label>
                  <textarea
                    rows={3}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-surface-container border border-surface-variant p-4 body-md focus:border-primary outline-none transition-all rounded-sm resize-none"
                    placeholder={t('profile.address_placeholder')}
                  />
                </div>
                
                <div className="md:col-span-2 pt-4">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="bg-primary text-white px-10 py-4 label-md tracking-normal lowercase hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-3 rounded-sm"
                  >
                    {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 size={18} />}
                    {t('profile.update_profile')}
                  </button>
                  
                  {message && (
                    <p
                      className={`mt-4 body-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}
                    >
                      {message.text}
                    </p>
                  )}
                </div>
              </form>

              <section
                className="mt-10"
                aria-label={t('profile.change_password')}
              >
                <div className="flex justify-start sm:justify-end">
                  <button
                    type="button"
                    onClick={handlePasswordChangeRequest}
                    disabled={isSendingPasswordEmail}
                    className="flex w-full items-center justify-center gap-3 whitespace-nowrap rounded-sm border border-primary px-6 py-3 text-primary transition-all hover:bg-primary hover:text-white disabled:opacity-50 sm:w-auto label-md tracking-normal normal-case"
                  >
                    {isSendingPasswordEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound size={18} />}
                    {isSendingPasswordEmail ? t('profile.change_password_sending') : t('profile.change_password')}
                  </button>
                </div>
                {passwordMessage && (
                  <div
                    className={`mt-5 flex items-start gap-3 rounded-sm border px-4 py-3 body-sm ${
                      passwordMessage.type === 'success'
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-red-200 bg-red-50 text-red-600'
                    }`}
                    role={passwordMessage.type === 'success' ? 'status' : 'alert'}
                  >
                    {passwordMessage.type === 'success'
                      ? <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
                      : <CircleAlert className="mt-0.5 shrink-0" size={18} />}
                    <span className="min-w-0 leading-relaxed normal-case">{passwordMessage.text}</span>
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-6">
              {orders.length === 0 ? (
                <EmptyState
                  icon={<Package size={48} strokeWidth={1} />}
                  title={t('order.no_orders')}
                  description={t('profile.collection_empty_desc')}
                  actionText={t('order.browse_collection')}
                  actionLink="/collections"
                />
              ) : (
                orders.map((order) => (
                  <div key={order.id} className="border border-surface-variant rounded-sm overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="bg-surface-container/30 p-6 flex flex-wrap justify-between items-center gap-4 border-b border-surface-variant">
                      <div className="flex gap-8">
                        <div>
                          <p className="label-xs text-secondary lowercase mb-1">{t('profile.order_date')}</p>
                          <p className="body-sm font-medium">{new Date(order.created_at).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                        </div>
                        <div>
                          <p className="label-xs text-secondary lowercase mb-1">{t('cart.total')}</p>
                          <p className="body-sm font-medium">{formatPrice(order.total_amount)}</p>
                        </div>
                        <div>
                          <p className="label-xs text-secondary lowercase mb-1">{t('order.status_label')}</p>
                          <span className="bg-primary/5 text-primary px-2 py-0.5 rounded-sm text-[10px] uppercase font-bold tracking-wider border border-primary/10">
                            {t(`order.status.${order.status}` as any)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="label-xs text-secondary">{t('profile.order_number', { id: order.order_code || order.id })}</span>
                        <Icons.ChevronRight size={16} className="text-secondary group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="flex flex-wrap gap-4">
                        {order.items.map((item) => (
                          <div key={item.id} className="w-16 h-16 bg-surface-container rounded-sm overflow-hidden flex-shrink-0 border border-surface-variant">
                            {item.image ? (
                              <ProductImage
                                src={item.image}
                                alt={item.product_name}
                                preset="thumb"
                                className="w-full h-full"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-secondary">
                                <Package size={16} />
                              </div>
                            )}
                          </div>
                        ))}
                        {order.items.length > 5 && (
                          <div className="w-16 h-16 bg-surface-container rounded-sm flex items-center justify-center label-sm text-secondary">
                            {t('profile.more_items', { count: order.items.length - 5 })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'items' && (
            <div>
              {purchasedItems.length === 0 ? (
                <EmptyState
                  icon={<Package size={48} strokeWidth={1} />}
                  title={t('profile.no_items_purchased')}
                  description={t('profile.collection_empty_desc')}
                  actionText={t('hero.cta')}
                  actionLink="/collections"
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {purchasedItems.map((item) => (
                    <div key={item.id} className="flex gap-4 p-4 border border-surface-variant rounded-sm hover:border-primary transition-colors">
                      <div className="w-24 h-24 bg-surface-container rounded-sm overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <ProductImage
                            src={item.image}
                            alt={item.product_name}
                            preset="thumb"
                            className="w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-secondary">
                            <Package size={24} />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col justify-center">
                        <h3 className="label-md lowercase tracking-tight line-clamp-1">{item.product_name}</h3>
                        <p className="body-sm text-secondary mt-1">{t('profile.acquired_for', { price: formatPrice(item.price) })}</p>
                        <button 
                          onClick={() => navigate(`/product/${item.product_id}`)}
                          className="mt-3 text-primary label-sm lowercase tracking-normal border-b border-primary w-fit hover:text-primary-container transition-colors"
                        >
                          {t('profile.view_product')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'loyalty' && (
            <LoyaltyDashboardPanel loyalty={loyalty} />
          )}

          {activeTab === 'affiliate' && affiliate?.is_affiliate && (
            <AffiliateDashboardPanel affiliate={affiliate} formatPrice={formatPrice} />
          )}
        </div>
      </div>
    </div>
  );
}

function LoyaltyDashboardPanel({ loyalty }: { loyalty: LoyaltyDashboard | null }) {
  const { t, i18n } = useTranslation();
  const transactions = loyalty?.transactions || [];

  return (
    <div className="space-y-8">
      <div className="grid gap-5 md:grid-cols-[minmax(0,280px)_1fr]">
        <div className="rounded-sm border border-primary/20 bg-primary/5 p-7">
          <div className="flex items-center gap-2 text-primary">
            <Star size={19} className="fill-primary" />
            <p className="label-sm">{t('profile.loyalty.balance')}</p>
          </div>
          <p className="mt-4 text-4xl font-bold text-primary">{loyalty?.points ?? 0}</p>
          <p className="mt-1 body-sm text-secondary">{t('profile.loyalty.points_unit')}</p>
        </div>
        <div className="rounded-sm border border-surface-variant bg-surface-container/30 p-7">
          <h2 className="headline-sm normal-case tracking-normal">{t('profile.loyalty.how_it_works')}</h2>
          <p className="mt-3 body-md leading-relaxed text-secondary">{t('profile.loyalty.rule')}</p>
          <p className="mt-2 body-sm leading-relaxed text-secondary">{t('profile.loyalty.reversal_rule')}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-sm border border-surface-variant bg-white">
        <div className="border-b border-surface-variant px-6 py-5">
          <h2 className="font-semibold">{t('profile.loyalty.history')}</h2>
        </div>
        {transactions.length === 0 ? (
          <p className="p-10 text-center body-sm text-secondary">{t('profile.loyalty.empty')}</p>
        ) : (
          <div className="divide-y divide-surface-variant">
            {transactions.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{t(`profile.loyalty.reasons.${item.reason}`)}</p>
                  <p className="mt-1 text-sm text-secondary">
                    {t('profile.loyalty.order', { id: item.order_id })} · {new Date(item.created_at).toLocaleString(i18n.language)}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className={`text-lg font-bold ${item.points_delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {item.points_delta > 0 ? '+' : ''}{item.points_delta}
                  </p>
                  <p className="text-xs text-secondary">{t('profile.loyalty.balance_after', { count: item.balance_after })}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AffiliateDashboardPanel({ affiliate, formatPrice }: { affiliate: AffiliateDashboard; formatPrice: (value: number | string) => string }) {
  const { t, i18n } = useTranslation();
  const referralLink = `${window.location.origin}/?ref=${affiliate.code}`;
  const totals = affiliate.totals || { pending: '0', available: '0', paid: '0', reversed: '0' };
  const cards = [
    { key: 'visits', value: affiliate.visits_count || 0, icon: MousePointerClick },
    { key: 'orders', value: affiliate.orders_count || 0, icon: Package },
    { key: 'pending', value: formatPrice(totals.pending), icon: WalletCards },
    { key: 'available', value: formatPrice(totals.available), icon: WalletCards },
    { key: 'paid', value: formatPrice(totals.paid), icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-8">
      <div className="rounded-sm border border-surface-variant bg-surface-container/30 p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="label-sm text-primary">{t('affiliate_dashboard.your_code')}</p>
            <h2 className="mt-2 font-mono text-3xl font-bold tracking-wider">{affiliate.code}</h2>
            <p className="mt-2 body-sm text-secondary">{t('affiliate_dashboard.rate', { rate: Number(affiliate.commission_rate || 0) })}</p>
          </div>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(referralLink)}
            className="inline-flex items-center justify-center gap-2 rounded-sm bg-primary px-6 py-3 text-sm font-semibold text-white"
          >
            <Copy size={17} /> {t('affiliate_dashboard.copy_link')}
          </button>
        </div>
        <div className="mt-5 flex items-center gap-2 overflow-hidden rounded-sm border border-surface-variant bg-white px-4 py-3 text-sm text-secondary">
          <Link2 size={16} className="shrink-0 text-primary" /><code className="truncate">{referralLink}</code>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(({ key, value, icon: Icon }) => (
          <div key={key} className="rounded-sm border border-surface-variant bg-white p-5">
            <Icon size={20} className="mb-4 text-primary" />
            <p className="text-xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-secondary">{t(`affiliate_dashboard.metrics.${key}`)}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-sm border border-surface-variant bg-white">
        <div className="border-b border-surface-variant px-5 py-4 font-semibold">{t('affiliate_dashboard.recent')}</div>
        {!affiliate.recent_commissions?.length ? (
          <p className="p-8 text-center text-sm text-secondary">{t('affiliate_dashboard.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-container/40 text-xs text-secondary"><tr><th className="px-5 py-3">{t('affiliate_dashboard.order')}</th><th className="px-5 py-3">{t('affiliate_dashboard.date')}</th><th className="px-5 py-3">{t('affiliate_dashboard.status')}</th><th className="px-5 py-3 text-right">{t('affiliate_dashboard.commission')}</th></tr></thead>
              <tbody className="divide-y divide-surface-variant">
                {affiliate.recent_commissions.map((commission) => (
                  <tr key={commission.id}><td className="px-5 py-4 font-semibold">#{commission.order_id}</td><td className="px-5 py-4 text-secondary">{new Date(commission.created_at).toLocaleDateString(i18n.language)}</td><td className="px-5 py-4"><span className="rounded-full bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary">{t(`affiliate_dashboard.statuses.${commission.status}`)}</span></td><td className="px-5 py-4 text-right font-semibold">{formatPrice(commission.amount)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
