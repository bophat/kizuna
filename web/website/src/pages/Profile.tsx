import React, { useState, useEffect } from 'react';
import { Icons } from '@/components/Icons';
import { Loader2, Package, Star, LogOut, CheckCircle2 } from 'lucide-react';
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



export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { format: formatPrice } = useFormatPrice();
  const [activeTab, setActiveTab] = useState<'info' | 'orders' | 'items'>('info');
  const [user, setUser] = useState<UserData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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
  }, []);

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
              <span className="label-sm text-primary font-bold">{t('profile.points', { count: user?.profile?.points || 0 })}</span>
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
                        <span className="label-xs text-secondary">{t('profile.order_number', { id: order.id })}</span>
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
        </div>
      </div>
    </div>
  );
}
