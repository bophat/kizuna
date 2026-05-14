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
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { apiFetch } from '../lib/api';

const STATUS_CONFIG: Record<string, { color: string, icon: any, label: string }> = {
  'pending': { color: 'bg-yellow-500', icon: Clock, label: 'Pending' },
  'processing': { color: 'bg-blue-500', icon: Loader2, label: 'Processing' },
  'shipped': { color: 'bg-purple-500', icon: Truck, label: 'Shipped' },
  'delivered': { color: 'bg-green-500', icon: CheckCircle, label: 'Delivered' },
  'cancelled': { color: 'bg-red-500', icon: XCircle, label: 'Cancelled' }
};

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
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
        setError('Failed to load logistics data.');
      }
    } catch (err) {
      setError('An error occurred while fetching orders.');
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
        alert('Failed to update order');
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
      order.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.user_details?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-brand-red" />
        <p className="text-sm font-serif italic text-brand-ink/40">Synchronizing logistics...</p>
      </div>
    );
  }

  return (
    <div className="ma-spacing space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <p className="text-xs font-medium text-brand-red tracking-[0.2em] uppercase mb-2">Order Fulfillment</p>
          <h1 className="text-4xl font-serif font-bold">Consignment Tracking</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white px-6 py-3 rounded-lg border border-brand-clay shadow-sm text-center min-w-[120px]">
            <p className="text-[10px] uppercase text-brand-ink/40 font-bold mb-1">Total Active</p>
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
              placeholder="Search by ID or email..." 
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
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <p className="text-xs text-brand-ink/40 font-medium ml-2">
              {filteredOrders.length} transactions found
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
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">Order ID</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">Customer</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">Date</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">Status</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">Amount</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-clay">
                <AnimatePresence>
                  {filteredOrders.map((order) => {
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
                          <p className="text-sm font-semibold text-brand-ink">{order.user_details?.email || order.email || 'Guest'}</p>
                          <p className="text-xs text-brand-ink/40">{order.user_details?.first_name} {order.user_details?.last_name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs text-brand-ink/60">{new Date(order.created_at).toLocaleDateString()}</p>
                          <p className="text-[10px] text-brand-ink/40">{new Date(order.created_at).toLocaleTimeString()}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white",
                            statusInfo.color
                          )}>
                            <statusInfo.icon size={10} className={order.status === 'processing' ? 'animate-spin' : ''} />
                            {statusInfo.label}
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
                        <p className="font-serif italic">No orders found matching your criteria...</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
                    <h2 className="text-2xl font-serif font-bold">Order Details</h2>
                    <span className="text-sm font-mono font-bold text-brand-red bg-brand-red/10 px-2 py-0.5 rounded">#{selectedOrder.id}</span>
                  </div>
                  <p className="text-xs text-brand-ink/40 uppercase tracking-widest font-medium">Placed on {new Date(selectedOrder.created_at).toLocaleString()}</p>
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
                        <h3 className="text-sm font-bold uppercase tracking-wider text-brand-ink/80">Customer Information</h3>
                      </div>
                      <div className="bg-brand-paper/30 p-4 rounded-xl border border-brand-clay space-y-3">
                        <div className="flex items-start gap-3">
                          <Mail size={16} className="text-brand-ink/30 mt-0.5" />
                          <div>
                            <p className="text-[10px] uppercase font-bold text-brand-ink/40 mb-0.5">Email Address</p>
                            <p className="text-sm font-medium">{selectedOrder.user_details?.email || selectedOrder.email || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Phone size={16} className="text-brand-ink/30 mt-0.5" />
                          <div>
                            <p className="text-[10px] uppercase font-bold text-brand-ink/40 mb-0.5">Contact Number</p>
                            <p className="text-sm font-medium">{selectedOrder.shipping_phone || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <div className="flex items-center gap-2 mb-4">
                        <MapPin className="text-brand-red" size={18} />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-brand-ink/80">Shipping Logistics</h3>
                      </div>
                      <div className="bg-brand-paper/30 p-4 rounded-xl border border-brand-clay">
                        <p className="text-[10px] uppercase font-bold text-brand-ink/40 mb-2">Delivery Address</p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {selectedOrder.shipping_address}
                        </p>
                      </div>
                    </section>

                    <section>
                      <div className="flex items-center gap-2 mb-4">
                        <CreditCard className="text-brand-red" size={18} />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-brand-ink/80">Payment Method</h3>
                      </div>
                      <div className="bg-brand-paper/30 p-4 rounded-xl border border-brand-clay flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-brand-ink capitalize">{selectedOrder.payment_method?.replace('_', ' ')}</p>
                          <p className="text-[10px] text-brand-ink/40 font-bold uppercase">Transaction Channel</p>
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
                        <h3 className="text-sm font-bold uppercase tracking-wider text-brand-ink/80">Artifacts in Consignment</h3>
                      </div>
                      <div className="bg-white border border-brand-clay rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-brand-paper/50">
                            <tr>
                              <th className="px-4 py-3 font-bold text-brand-ink/60">Product</th>
                              <th className="px-4 py-3 font-bold text-brand-ink/60 text-center">Qty</th>
                              <th className="px-4 py-3 font-bold text-brand-ink/60 text-right">Price</th>
                              <th className="px-4 py-3 font-bold text-brand-ink/60 text-right">Total</th>
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
                              <td colSpan={3} className="px-4 py-4 text-right font-serif italic text-brand-ink/60">Total Consignment Value</td>
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
                          <h3 className="text-sm font-bold uppercase tracking-wider text-brand-ink/80">Payment Verification</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <p className="text-xs text-brand-ink/60 leading-relaxed font-serif italic">
                              Please examine the uploaded receipt carefully. Verify that the amount matches the total value of the consignment before proceeding with fulfillment.
                            </p>
                            <div className="space-y-2">
                              <label className="text-[10px] uppercase font-bold text-brand-ink/40">Administrative Notes</label>
                              <textarea 
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                placeholder="Record verification details, transaction IDs, or issues..."
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
                                {isUpdating ? 'Updating...' : 'Verify & Process'}
                              </button>
                              <button 
                                disabled={isUpdating}
                                onClick={() => handleUpdateOrder(selectedOrder.id, { admin_notes: adminNotes })}
                                className="px-4 bg-brand-paper border border-brand-clay text-brand-ink py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:border-brand-ink transition-all"
                              >
                                Save Notes
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
                                  View Full Artifact
                                </a>
                              </>
                            ) : (
                              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center gap-2">
                                <FileText size={32} className="text-brand-ink/20" />
                                <p className="text-xs font-serif italic text-brand-ink/40">No payment receipt has been uploaded for this transaction yet.</p>
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
                              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-ink/80">Order Fulfillment Status</h3>
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
                                  {s}
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
