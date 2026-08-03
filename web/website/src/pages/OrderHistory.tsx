import { useEffect, useState } from 'react';
import { Icons } from '@/components/Icons';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api';
import { useFormatPrice } from '@/hooks/useFormatPrice';

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
  subtotal_amount: string;
  shipping_amount: string;
  discount_amount: string;
  coupon_code: string;
  total_amount: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
  payment: null | {
    status: string;
    method: string;
    settlement_amount: string;
    settlement_currency: string;
    reference: string;
    receipt_url: string | null;
    proof_submitted_at: string | null;
    paid_at: string | null;
    expires_at: string | null;
  };
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
  const { format: formatPrice } = useFormatPrice();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingOrderId, setUploadingOrderId] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<Record<number, string>>({});

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
  }, [i18n.language, t]);


  const getStatusStep = (status: string) => STATUS_STEPS.indexOf(status);

  const uploadReceipt = async (orderId: number, file: File) => {
    setUploadingOrderId(orderId);
    setUploadError((current) => ({ ...current, [orderId]: '' }));
    try {
      const body = new FormData();
      body.append('receipt', file);
      const response = await apiFetch(`/shop/orders/${orderId}/payment-proof/`, {
        method: 'POST',
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(t('order.receipt_upload_error'));
      setOrders((current) => current.map((order) => (
        order.id === orderId ? { ...order, payment: data } : order
      )));
    } catch (err) {
      setUploadError((current) => ({
        ...current,
        [orderId]: err instanceof Error ? err.message : t('order.receipt_upload_error'),
      }));
    } finally {
      setUploadingOrderId(null);
    }
  };

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
                      {t('order.total', { amount: formatPrice(order.total_amount) })}
                      {' · '}
                      {t('order.payment', { method: t(`checkout.${order.payment_method}`, { defaultValue: order.payment_method }) })}
                    </p>
                    {order.payment && (
                      <p className="mt-1 body-md text-secondary">
                        {t('order.payment_status')}: <strong className="text-on-surface">{t(`order.payment_statuses.${order.payment.status}`)}</strong>
                      </p>
                    )}
                    {order.coupon_code && parseFloat(order.discount_amount || '0') > 0 && (
                      <p className="mt-2 inline-flex rounded-sm bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        {t('order.coupon_applied', {
                          code: order.coupon_code,
                          amount: formatPrice(order.discount_amount),
                        })}
                      </p>
                    )}
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

                {order.payment?.method === 'bank_transfer' && (
                  <div className="mb-8 rounded-sm border border-surface-variant bg-surface-container-lowest p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="label-md normal-case tracking-normal">{t('order.bank_payment_reference', { reference: order.payment.reference })}</p>
                        {order.payment.expires_at && order.payment.status === 'pending' && (
                          <p className="mt-1 text-sm text-secondary">{t('order.payment_expires', { date: new Date(order.payment.expires_at).toLocaleString(i18n.language) })}</p>
                        )}
                        {order.payment.status === 'proof_submitted' && <p className="mt-1 text-sm text-amber-700">{t('order.receipt_waiting_review')}</p>}
                        {order.payment.status === 'paid' && <p className="mt-1 text-sm text-emerald-700">{t('order.payment_verified')}</p>}
                      </div>
                      {['pending', 'proof_submitted'].includes(order.payment.status) && (
                        <label className="cursor-pointer rounded-sm bg-primary px-5 py-3 text-center text-sm font-bold text-white transition hover:opacity-90">
                          {uploadingOrderId === order.id ? t('order.uploading_receipt') : t(order.payment.status === 'proof_submitted' ? 'order.replace_receipt' : 'order.upload_receipt')}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            disabled={uploadingOrderId === order.id}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) void uploadReceipt(order.id, file);
                              event.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>
                    {uploadError[order.id] && <p className="mt-3 text-sm text-red-600">{uploadError[order.id]}</p>}
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
                        <p className="label-md mt-2">{formatPrice(item.price)}</p>
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
