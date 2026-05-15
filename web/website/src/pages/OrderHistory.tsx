import { useEffect, useState } from 'react';
import { Icons } from '@/components/Icons';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api';

interface OrderItem {
  id: number;
  product_id: string;
  quantity: number;
  price: string;
}

interface Order {
  id: number;
  status: string;
  payment_method: string;
  total_amount: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

const STATUS_STEPS = ['pending', 'processing', 'shipped', 'delivered'];
const STATUS_LABELS: Record<string, string> = {
  pending: 'order.status.pending',
  processing: 'order.status.processing',
  shipped: 'order.status.shipped',
  delivered: 'order.status.delivered',
  cancelled: 'order.status.cancelled',
};



export function OrderHistoryPage() {
  const { t, i18n } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await apiFetch('/shop/orders/');
        if (!res.ok) throw new Error('Failed to fetch orders');
        const data = await res.json();
        setOrders(data);
      } catch (err) {
        console.error(err);
        setError(t('order.error_loading'));
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, []);


  const getStatusStep = (status: string) => STATUS_STEPS.indexOf(status);

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-12 md:py-16">
      <header className="mb-12">
        <h1 className="headline-xl">{t('order.history_title')}</h1>
        <p className="body-md text-secondary mt-2 max-w-2xl">
          {t('order.history_subtitle')}
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="body-lg text-red-500 mb-4">{error}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20">
          <p className="body-lg text-secondary mb-4">{t('order.no_orders')}</p>
          <Link to="/collections" className="text-primary border-b border-primary hover:text-primary-container transition-all">
            {t('order.browse_collection')}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {orders.map((order) => {
            const stepIndex = getStatusStep(order.status);
            const progressPercent = stepIndex >= 0
              ? `${(stepIndex / (STATUS_STEPS.length - 1)) * 100}%`
              : '0%';
            const orderDate = new Date(order.created_at).toLocaleDateString(i18n.language, {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });

            return (
              <article key={order.id} className="bg-white border border-surface-variant rounded-sm p-8 group hover:shadow-lg transition-shadow">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8 border-b border-surface-variant pb-8">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="label-md lowercase tracking-tight">{t('order.order_number', { id: order.id })}</span>
                      <span className="bg-primary-container/10 text-primary px-3 py-1 rounded-sm label-sm border border-primary-container/20 capitalize">
                        {t(STATUS_LABELS[order.status] || order.status)}
                      </span>
                    </div>
                    <p className="body-md text-secondary">{t('order.placed_on', { date: orderDate })}</p>
                    <p className="body-md text-secondary mt-1">
                      {t('order.total', { amount: `$${parseFloat(order.total_amount).toFixed(2)}` })}
                      {' · '}
                      {t('order.payment', { method: order.payment_method })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-sm hover:opacity-90 transition-all label-md tracking-normal normal-case">
                      <Icons.Truck size={18} />
                      {t('order.track_package')}
                    </button>
                  </div>
                </div>

                {/* Status Tracking */}
                {order.status !== 'cancelled' && (
                  <div className="mb-8 py-4">
                    <div className="relative flex items-center justify-between w-full">
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-px bg-surface-variant -z-10" />
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-px bg-primary -z-10 transition-all duration-700"
                        style={{ width: progressPercent }}
                      />
                      {STATUS_STEPS.map((step, i) => (
                        <div key={step} className="flex flex-col items-center gap-2 bg-white px-4">
                          <div className={`w-4 h-4 rounded-full border-2 transition-all ${i <= stepIndex ? 'bg-primary border-primary' : 'bg-white border-surface-variant'}`} />
                          <span className={`label-sm lowercase tracking-normal ${i === stepIndex ? 'text-primary font-bold' : 'text-secondary'}`}>
                            {t(STATUS_LABELS[step])}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Order Items */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex gap-6 items-center">
                      <div className="w-20 h-20 bg-surface-container overflow-hidden rounded-sm flex-shrink-0 flex items-center justify-center text-secondary">
                        <Icons.Package size={24} strokeWidth={1} />
                      </div>
                      <div>
                        <h3 className="label-md normal-case tracking-normal font-mono text-xs text-secondary">
                          {t('order.product_id', { id: item.product_id })}
                        </h3>
                        <p className="body-md text-secondary mt-1">{t('order.qty', { count: item.quantity })}</p>
                        <p className="label-md mt-2">${parseFloat(item.price).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
