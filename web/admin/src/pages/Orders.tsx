import { useEffect, useState } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Filter, 
  MoreVertical, 
  Eye, 
  CheckCircle, 
  Truck, 
  XCircle,
  Loader2,
  AlertCircle,
  Clock,
  ExternalLink,
  MapPin,
  Mail,
  Phone,
  Package,
  CreditCard,
  X,
  ShieldCheck,
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { cn } from '../lib/utils';
import { apiFetch } from '../lib/api';

const STATUS_CONFIG: Record<string, { color: string, icon: any, key: string }> = {
  'pending': { color: 'bg-yellow-500', icon: Clock, key: 'pending' },
  'processing': { color: 'bg-blue-500', icon: Loader2, key: 'processing' },
  'shipped': { color: 'bg-purple-500', icon: Truck, key: 'shipped' },
  'delivered': { color: 'bg-green-500', icon: CheckCircle, key: 'delivered' },
  'cancelled': { color: 'bg-red-500', icon: XCircle, key: 'cancelled' }
};

export default function Orders() {
  const { t, i18n } = useTranslation();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Modal State
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/orders/');
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
        setError(null);
      } else {
        setError(t('orders.errors.load_failed'));
      }
    } catch (err) {
      setError(t('orders.errors.fetch_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleOpenDetails = (order: any) => {
    setSelectedOrder(order);
    setAdminNotes(order.admin_notes || '');
    setIsModalOpen(true);
  };

  const handleUpdateOrder = async (orderId: number, updates: any) => {
    setIsUpdating(true);
    try {
      const response = await apiFetch(`/orders/${orderId}/`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
      if (response.ok) {
        const updatedOrder = await response.json();
        setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(updatedOrder);
        }
      } else {
        alert(t('orders.errors.update_failed'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.id.toString().includes(searchQuery) ||
      order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, itemsPerPage]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-brand-red" />
        <p className="text-sm font-serif italic text-brand-ink/40">{t('common.loading_logistics')}</p>
      </div>
    );
  }

  return (
    <div className="ma-spacing space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <p className="text-xs font-medium text-brand-red tracking-[0.2em] uppercase mb-2">{t('orders.subtitle')}</p>
          <h1 className="text-4xl font-serif font-bold">{t('orders.title')}</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white px-6 py-3 rounded-lg border border-brand-clay shadow-sm text-center min-w-[120px]">
            <p className="text-[10px] uppercase text-brand-ink/40 font-bold mb-1">{t('orders.total_active')}</p>
            <p className="text-2xl font-serif font-bold text-brand-red">{orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-brand-clay shadow-sm overflow-hidden">
        <div className="p-4 border-b border-brand-clay bg-brand-paper/30 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/30" size={18} />
            <input 
              type="text" 
              placeholder={t('orders.search_placeholder')} 
              className="w-full pl-10 pr-4 py-2 bg-white border border-brand-clay rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <select 
              className="text-xs font-medium bg-white border border-brand-clay rounded-md px-4 py-2 outline-none focus:border-brand-red"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">{t('orders.all_statuses')}</option>
              <option value="pending">{t('orders.status.pending')}</option>
              <option value="processing">{t('orders.status.processing')}</option>
              <option value="shipped">{t('orders.status.shipped')}</option>
              <option value="delivered">{t('orders.status.delivered')}</option>
              <option value="cancelled">{t('orders.status.cancelled')}</option>
            </select>
            <p className="text-xs text-brand-ink/40 font-medium ml-2">
              {filteredOrders.length} {t('orders.transactions_found')}
            </p>
          </div>
        </div>

        {error ? (
          <div className="p-12 text-center space-y-4">
            <div className="inline-flex p-3 bg-red-50 text-brand-red rounded-full">
              <AlertCircle size={24} />
            </div>
            <p className="text-brand-ink/60 font-serif italic">{error}</p>
            <button onClick={fetchOrders} className="text-brand-red text-sm font-bold hover:underline">Try again</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-brand-paper">
                <tr>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">{t('orders.table.id')}</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">{t('orders.table.customer')}</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">{t('orders.table.date')}</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">{t('orders.table.status')}</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">{t('orders.table.amount')}</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50 text-right">{t('orders.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-clay">
                <AnimatePresence>
                  {paginatedOrders.map((order) => {
                    const statusInfo = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                    return (
                      <motion.tr 
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        key={order.id} 
                        className="hover:bg-brand-paper/50 transition-colors group cursor-pointer"
                        onClick={() => handleOpenDetails(order)}
                      >
                        <td className="px-6 py-4">
                          <p className="text-sm font-mono font-bold text-brand-ink">#{order.id}</p>
                          <p className="text-[10px] text-brand-ink/40 uppercase tracking-widest">{order.payment_method}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-brand-ink">{order.user_details?.email || order.email || t('orders.table.guest')}</p>
                          <p className="text-xs text-brand-ink/40">{order.user_details?.first_name} {order.user_details?.last_name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs text-brand-ink/60">{new Date(order.created_at).toLocaleDateString(i18n.language)}</p>
                          <p className="text-[10px] text-brand-ink/40">{new Date(order.created_at).toLocaleTimeString()}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white",
                            statusInfo.color
                          )}>
                            <statusInfo.icon size={10} className={order.status === 'processing' ? 'animate-spin' : ''} />
                            {t(`orders.status.${order.status}`)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-brand-ink">
                          ${parseFloat(order.total_amount).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            className="p-2 hover:bg-brand-clay rounded-md transition-all text-brand-ink/40 hover:text-brand-red"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetails(order);
                            }}
                          >
                            <Eye size={18} />
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-2 text-brand-ink/30">
                        <ShoppingBag size={40} strokeWidth={1} />
                        <p className="font-serif italic">{t('orders.table.empty')}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filteredOrders.length > 0 && (
          <div className="p-4 border-t border-brand-clay flex flex-col sm:flex-row justify-between items-center gap-4 bg-brand-paper/10">
            <div className="flex items-center gap-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-ink/40">
                {t('filter.show_per_page', { defaultValue: 'Show' })}:
              </p>
              <div className="flex gap-1">
                {[10, 20, 50].map(size => (
                  <button
                    key={size}
                    onClick={() => setItemsPerPage(size)}
                    className={cn(
                      "px-3 py-1 rounded text-[10px] font-bold transition-all border",
                      itemsPerPage === size 
                        ? "bg-brand-ink border-brand-ink text-white" 
                        : "bg-white border-brand-clay text-brand-ink/60 hover:border-brand-ink"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-2 hover:bg-brand-clay rounded-md transition-all text-brand-ink/40 hover:text-brand-red disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => {
                    if (totalPages <= 5) return true;
                    return p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1;
                  })
                  .map((p, i, arr) => (
                    <React.Fragment key={p}>
                      {i > 0 && arr[i-1] !== p - 1 && (
                        <span className="px-1 text-brand-ink/20">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(p)}
                        className={cn(
                          "w-8 h-8 rounded text-[10px] font-bold transition-all",
                          currentPage === p 
                            ? "bg-brand-red text-white" 
                            : "text-brand-ink/60 hover:bg-brand-clay"
                        )}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))
                }
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="p-2 hover:bg-brand-clay rounded-md transition-all text-brand-ink/40 hover:text-brand-red disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-ink/40 italic">
              {t('filter.showing_range', { 
                defaultValue: 'Showing {{start}}-{{end}} of {{total}}',
                start: Math.min(filteredOrders.length, (currentPage - 1) * itemsPerPage + 1),
                end: Math.min(filteredOrders.length, currentPage * itemsPerPage),
                total: filteredOrders.length
              })}
            </p>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      <AnimatePresence>
        {isModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-brand-ink/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="px-8 py-6 border-b border-brand-clay flex justify-between items-center bg-brand-paper/30">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-2xl font-serif font-bold">{t('orders.modal.title')}</h2>
                    <span className="text-sm font-mono font-bold text-brand-red bg-brand-red/10 px-2 py-0.5 rounded">#{selectedOrder.id}</span>
                  </div>
                  <p className="text-xs text-brand-ink/40 uppercase tracking-widest font-medium">{t('orders.modal.placed_on')} {new Date(selectedOrder.created_at).toLocaleString()}</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-brand-clay rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column: Customer & Shipping */}
                  <div className="lg:col-span-1 space-y-8">
                    <section>
                      <div className="flex items-center gap-2 mb-4">
                        <ShieldCheck className="text-brand-red" size={18} />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-brand-ink/80">{t('orders.modal.customer_info')}</h3>
                      </div>
                      <div className="bg-brand-paper/30 p-4 rounded-xl border border-brand-clay space-y-3">
                        <div className="flex items-start gap-3">
                          <Mail size={16} className="text-brand-ink/30 mt-0.5" />
                          <div>
                            <p className="text-[10px] uppercase font-bold text-brand-ink/40 mb-0.5">{t('orders.modal.email')}</p>
                            <p className="text-sm font-medium">{selectedOrder.user_details?.email || selectedOrder.email || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Phone size={16} className="text-brand-ink/30 mt-0.5" />
                          <div>
                            <p className="text-[10px] uppercase font-bold text-brand-ink/40 mb-0.5">{t('orders.modal.phone')}</p>
                            <p className="text-sm font-medium">{selectedOrder.shipping_phone || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <div className="flex items-center gap-2 mb-4">
                        <MapPin className="text-brand-red" size={18} />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-brand-ink/80">{t('orders.modal.shipping_logistics')}</h3>
                      </div>
                      <div className="bg-brand-paper/30 p-4 rounded-xl border border-brand-clay">
                        <p className="text-[10px] uppercase font-bold text-brand-ink/40 mb-2">{t('orders.modal.address')}</p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {selectedOrder.shipping_address}
                        </p>
                      </div>
                    </section>

                    <section>
                      <div className="flex items-center gap-2 mb-4">
                        <CreditCard className="text-brand-red" size={18} />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-brand-ink/80">{t('orders.modal.payment_method')}</h3>
                      </div>
                      <div className="bg-brand-paper/30 p-4 rounded-xl border border-brand-clay flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-brand-ink capitalize">{selectedOrder.payment_method?.replace('_', ' ')}</p>
                          <p className="text-[10px] text-brand-ink/40 font-bold uppercase">{t('orders.modal.transaction_channel')}</p>
                        </div>
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold text-white",
                          STATUS_CONFIG[selectedOrder.status]?.color
                        )}>
                          {selectedOrder.status}
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* Middle Column: Items & Receipt */}
                  <div className="lg:col-span-2 space-y-8">
                    <section>
                      <div className="flex items-center gap-2 mb-4">
                        <Package className="text-brand-red" size={18} />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-brand-ink/80">{t('orders.modal.items')}</h3>
                      </div>
                      <div className="bg-white border border-brand-clay rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-brand-paper/50">
                            <tr>
                              <th className="px-4 py-3 font-bold text-brand-ink/60">{t('orders.modal.table.product')}</th>
                              <th className="px-4 py-3 font-bold text-brand-ink/60 text-center">{t('orders.modal.table.qty')}</th>
                              <th className="px-4 py-3 font-bold text-brand-ink/60 text-right">{t('orders.modal.table.price')}</th>
                              <th className="px-4 py-3 font-bold text-brand-ink/60 text-right">{t('orders.modal.table.total')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-brand-clay">
                            {selectedOrder.items?.map((item: any) => (
                              <tr key={item.id} className="hover:bg-brand-paper/20">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-brand-paper rounded border border-brand-clay overflow-hidden flex-shrink-0">
                                      {item.product_details?.image && (
                                        <img src={item.product_details.image} alt="" className="w-full h-full object-cover" />
                                      )}
                                    </div>
                                    <p className="font-medium text-brand-ink">{item.product_details?.name}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center font-mono">x{item.quantity}</td>
                                <td className="px-4 py-3 text-right font-mono text-brand-ink/60">${parseFloat(item.price).toLocaleString()}</td>
                                <td className="px-4 py-3 text-right font-bold text-brand-ink">${(item.quantity * parseFloat(item.price)).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-brand-paper/10">
                            <tr>
                              <td colSpan={3} className="px-4 py-4 text-right font-serif italic text-brand-ink/60">{t('orders.modal.total_value')}</td>
                              <td className="px-4 py-4 text-right text-lg font-serif font-bold text-brand-red">${parseFloat(selectedOrder.total_amount).toLocaleString()}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </section>

                    {selectedOrder.payment_method === 'bank_transfer' && (
                      <section>
                        <div className="flex items-center gap-2 mb-4">
                          <FileText className="text-brand-red" size={18} />
                          <h3 className="text-sm font-bold uppercase tracking-wider text-brand-ink/80">{t('orders.modal.verification')}</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <p className="text-xs text-brand-ink/60 leading-relaxed font-serif italic">
                              {t('orders.modal.verify_help')}
                            </p>
                            <div className="space-y-2">
                              <label className="text-[10px] uppercase font-bold text-brand-ink/40">{t('orders.modal.admin_notes')}</label>
                              <textarea 
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                placeholder={t('orders.modal.admin_notes_placeholder')}
                                className="w-full h-32 p-3 text-sm bg-brand-paper/20 border border-brand-clay rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red transition-all resize-none"
                              />
                            </div>
                            <div className="flex gap-3">
                              <button 
                                disabled={isUpdating || selectedOrder.status !== 'pending'}
                                onClick={() => handleUpdateOrder(selectedOrder.id, { 
                                  status: 'processing', 
                                  admin_notes: adminNotes 
                                })}
                                className="flex-1 bg-brand-ink text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-brand-red transition-all disabled:opacity-50 disabled:bg-brand-clay"
                              >
                                {isUpdating ? t('orders.modal.updating') : t('orders.modal.verify_button')}
                              </button>
                              <button 
                                disabled={isUpdating}
                                onClick={() => handleUpdateOrder(selectedOrder.id, { admin_notes: adminNotes })}
                                className="px-4 bg-brand-paper border border-brand-clay text-brand-ink py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:border-brand-ink transition-all"
                              >
                                {t('orders.modal.save_notes')}
                              </button>
                            </div>
                          </div>
                          
                          <div className="relative aspect-[4/5] bg-brand-paper rounded-xl border-2 border-dashed border-brand-clay overflow-hidden group">
                            {selectedOrder.payment_receipt ? (
                              <>
                                <img 
                                  src={selectedOrder.payment_receipt} 
                                  alt="Payment Receipt" 
                                  className="w-full h-full object-contain p-2"
                                />
                                <a 
                                  href={selectedOrder.payment_receipt} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="absolute inset-0 bg-brand-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold uppercase tracking-widest gap-2"
                                >
                                  <ExternalLink size={16} />
                                  {t('orders.modal.view_artifact')}
                                </a>
                              </>
                            ) : (
                              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center gap-2">
                                <FileText size={32} className="text-brand-ink/20" />
                                <p className="text-xs font-serif italic text-brand-ink/40">{t('orders.modal.no_receipt')}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </section>
                    )}

                    {selectedOrder.payment_method !== 'bank_transfer' && (
                      <section className="bg-brand-paper/30 p-6 rounded-xl border border-brand-clay">
                        <div className="flex items-center justify-between">
                          <div className="space-y-4 flex-1">
                            <div className="flex items-center gap-2">
                              <ShieldCheck size={18} className="text-green-600" />
                              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-ink/80">{t('orders.modal.fulfillment')}</h3>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {Object.keys(STATUS_CONFIG).map(s => (
                                <button
                                  key={s}
                                  onClick={() => handleUpdateOrder(selectedOrder.id, { status: s })}
                                  className={cn(
                                    "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border",
                                    selectedOrder.status === s 
                                      ? "bg-brand-ink text-white border-brand-ink" 
                                      : "bg-white text-brand-ink/60 border-brand-clay hover:border-brand-ink"
                                  )}
                                >
                                  {t(`orders.status.${s}`)}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </section>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
