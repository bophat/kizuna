/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  Users, 
  ShoppingBag, 
  Package, 
  ArrowUpRight, 
  ArrowDownRight,
  Loader2,
  Calendar,
  Layers,
  Database,
  Plus,
  ArrowRight,
  Zap,
  Tag,
  Star,
  Activity
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { apiFetch } from '../lib/api';
import { cn } from '../lib/utils';

function StatCard({ title, value, icon: Icon, trend, isCurrency, delay = 0 }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white p-8 rounded-sm border border-brand-clay shadow-sm hover:shadow-xl transition-all group overflow-hidden relative"
    >
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className="p-3 bg-brand-paper rounded-sm group-hover:bg-brand-red group-hover:text-white transition-colors duration-500">
          <Icon size={20} />
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full",
            trend.startsWith('+') ? "text-emerald-600 bg-emerald-50" : "text-brand-red bg-brand-red/5"
          )}>
            {trend.startsWith('+') ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {trend}
          </div>
        )}
      </div>
      <div className="relative z-10">
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40 mb-1">{title}</p>
        <h3 className="text-3xl font-serif font-bold text-brand-ink tracking-tight">
          {isCurrency ? `$${value?.toLocaleString() || '0'}` : value?.toLocaleString() || '0'}
        </h3>
      </div>
      <div className="absolute -right-4 -bottom-4 text-brand-clay/5 group-hover:text-brand-clay/10 transition-colors duration-700">
        <Icon size={120} strokeWidth={1} />
      </div>
    </motion.div>
  );
}

function QuickAction({ title, icon: Icon, link, delay = 0 }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
    >
      <Link 
        to={link}
        className="flex items-center justify-between p-6 bg-white border border-brand-clay rounded-sm hover:border-brand-red/30 hover:shadow-lg transition-all group"
      >
        <div className="flex items-center gap-4">
          <div className="p-2 bg-brand-paper rounded-sm text-brand-ink group-hover:text-brand-red transition-colors">
            <Icon size={18} />
          </div>
          <span className="text-xs font-bold text-brand-ink uppercase tracking-wider">{title}</span>
        </div>
        <ArrowRight size={16} className="text-brand-clay group-hover:text-brand-red group-hover:translate-x-1 transition-all" />
      </Link>
    </motion.div>
  );
}

const COLORS = ['#99051D', '#1C1B1B', '#F5F2ED', '#D9D9D9', '#8C8C8C'];

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await apiFetch('/stats/');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="h-[calc(100vh-80px)] flex flex-col items-center justify-center gap-6 bg-brand-paper/30">
        <div className="relative">
          <Loader2 className="w-12 h-12 animate-spin text-brand-red" />
          <div className="absolute inset-0 blur-xl bg-brand-red/20 animate-pulse rounded-full"></div>
        </div>
        <div className="flex flex-col items-center">
          <p className="text-lg font-serif italic text-brand-ink">Synchronizing Registry...</p>
          <p className="text-[10px] uppercase tracking-[0.3em] text-brand-ink/30 mt-2 font-bold">KIZUNA Administrative Core</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-12 space-y-12 pb-20 max-w-[1600px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-brand-clay pb-12">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Activity size={16} className="text-brand-red" />
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-red">Operational Overview</span>
          </div>
          <h1 className="text-5xl font-serif font-bold text-brand-ink mb-4">Registry Insight</h1>
          <p className="text-brand-ink/40 font-serif italic max-w-lg">
            Welcome to the KIZUNA administrative core. Monitoring artifact flows, collector engagement, and acquisition metrics in real-time.
          </p>
        </div>
        <div className="flex items-center gap-4 bg-white border border-brand-clay p-4 rounded-sm shadow-sm">
          <Calendar size={18} className="text-brand-ink/30" />
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest font-bold text-brand-ink/40">Current Period</p>
            <p className="text-xs font-bold text-brand-ink">{new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
      </div>

      {/* StatCards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Acquisitions" 
          value={stats?.total_revenue || 0} 
          icon={TrendingUp} 
          trend="+12.5%" 
          isCurrency 
          delay={0.1}
        />
        <StatCard 
          title="Active Collectors" 
          value={stats?.total_users || 0} 
          icon={Users} 
          trend="+5.2%" 
          delay={0.2}
        />
        <StatCard 
          title="Total Trades" 
          value={stats?.total_orders || 0} 
          icon={ShoppingBag} 
          trend="+8.1%" 
          delay={0.3}
        />
        <StatCard 
          title="Archive Size" 
          value={stats?.total_products || 0} 
          icon={Package} 
          delay={0.4}
        />
      </div>
      
      {/* Main Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2 bg-white p-12 rounded-sm border border-brand-clay shadow-xl relative overflow-hidden group"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-16 relative z-10 gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Layers size={14} className="text-brand-red" />
                <h2 className="text-3xl font-serif font-bold text-brand-ink">Trade Performance</h2>
              </div>
              <p className="text-sm text-brand-ink/40 font-serif italic">Weekly acquisition and sales metrics analysis.</p>
            </div>
          </div>
          
          <div className="h-[400px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.chart_data || []}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#99051D" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#99051D" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F5F2ED" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#1C1B1B', fontWeight: 700, opacity: 0.3 }} 
                  dy={15}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#1C1B1B', fontWeight: 700, opacity: 0.3 }} 
                  dx={-15}
                />
                <Tooltip 
                  cursor={{ stroke: '#99051D', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={{ 
                    backgroundColor: '#fff',
                    borderRadius: '0', 
                    border: '1px solid #F5F2ED', 
                    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)',
                    fontFamily: 'serif',
                    fontSize: '12px',
                    padding: '16px'
                  }}
                  itemStyle={{ fontWeight: 700, color: '#1C1B1B' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#99051D" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="absolute top-0 right-0 p-8 text-[6rem] font-serif font-bold text-brand-clay/10 pointer-events-none select-none">
            績
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white p-10 rounded-sm border border-brand-clay shadow-xl relative overflow-hidden"
        >
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <Tag size={14} className="text-brand-red" />
              <h2 className="text-2xl font-serif font-bold text-brand-ink">Collection Shares</h2>
            </div>
            <p className="text-xs text-brand-ink/40 font-serif italic">Revenue distribution by category.</p>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.revenue_by_category || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats?.revenue_by_category?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ 
                    backgroundColor: '#fff',
                    borderRadius: '0', 
                    border: '1px solid #F5F2ED', 
                    fontFamily: 'serif',
                    fontSize: '10px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-8 space-y-3">
            {stats?.revenue_by_category?.map((item: any, index: number) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-[10px] font-bold text-brand-ink uppercase tracking-tight">{item.name}</span>
                </div>
                <span className="text-[10px] font-serif italic text-brand-ink/60">${item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Secondary Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="lg:col-span-2 bg-white p-12 rounded-sm border border-brand-clay shadow-xl"
        >
          <div className="flex items-center justify-between mb-12">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Star size={14} className="text-brand-red" />
                <h2 className="text-3xl font-serif font-bold text-brand-ink">Top Artifacts</h2>
              </div>
              <p className="text-sm text-brand-ink/40 font-serif italic">Most coveted pieces in the current collection.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {stats?.top_selling_products?.map((product: any, index: number) => (
              <motion.div 
                key={product.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + (index * 0.1) }}
                className="flex items-center gap-6 group cursor-pointer"
              >
                <div className="w-20 h-20 bg-brand-paper border border-brand-clay overflow-hidden relative shrink-0">
                  <img 
                    src={product.image} 
                    alt={product.name} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-brand-ink/10 group-hover:bg-transparent transition-colors"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-brand-ink truncate group-hover:text-brand-red transition-colors uppercase tracking-tight">{product.name}</h4>
                  <p className="text-[10px] text-brand-ink/40 font-serif italic mb-2">{product.category_name}</p>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-brand-ink">${parseFloat(product.price).toLocaleString()}</span>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-sm">{product.sales} Sales</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className="space-y-8 flex flex-col">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-brand-ink text-white p-10 rounded-sm flex flex-col flex-1 overflow-hidden relative group shadow-2xl"
          >
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-4 mb-8">
                  <Zap size={16} className="text-brand-red animate-pulse" />
                  <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-brand-red">System Core</p>
                </div>
                <h2 className="text-4xl font-serif mb-6 italic leading-tight tracking-tight">Mamoru Monitor</h2>
                <p className="text-brand-paper/40 text-sm font-serif leading-relaxed mb-10">
                  The internal engine is operating at peak efficiency. All artifact registries are synchronized.
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-sm border border-white/10 group-hover:border-brand-red/40 transition-all duration-700 backdrop-blur-sm">
                    <div className="w-12 h-12 rounded-sm bg-brand-red/10 flex items-center justify-center border border-brand-red/30 shrink-0">
                      <div className="text-3xl font-serif text-brand-red">衛</div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold tracking-[0.2em] uppercase mb-1">Guardian</p>
                      <p className="text-[10px] text-white/30 italic font-serif">Registry verified</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-sm border border-white/10 group-hover:border-brand-red/40 transition-all duration-700 backdrop-blur-sm">
                    <div className="w-12 h-12 rounded-sm bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                      <Database size={18} className="text-brand-paper/40" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold tracking-[0.2em] uppercase mb-1">Repository</p>
                      <p className="text-[10px] text-white/30 italic font-serif">SQLite Connected</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-10 pt-8 border-t border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                  <span className="text-[10px] font-mono text-white/40 italic">Secure Session</span>
                </div>
                <ArrowUpRight size={18} className="text-white/20 group-hover:text-brand-red transition-colors" />
              </div>
            </div>
            
            <div className="absolute top-0 right-0 w-48 h-48 bg-brand-red/10 blur-[80px] rounded-full pointer-events-none"></div>
          </motion.div>

          <div className="space-y-4">
            <p className="text-[10px] uppercase font-bold text-brand-ink/30 tracking-[0.3em] ml-2 mb-4">Quick Logistics</p>
            <QuickAction title="Catalog New Artifact" icon={Plus} link="/inventory" delay={0.7} />
            <QuickAction title="Review Trades" icon={ShoppingBag} link="/orders" delay={0.8} />
            <QuickAction title="Collector Management" icon={Users} link="/users" delay={0.9} />
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="bg-white rounded-sm border border-brand-clay shadow-2xl overflow-hidden"
      >
        <div className="px-12 py-12 border-b border-brand-clay flex flex-col md:flex-row justify-between items-center gap-8 bg-brand-paper/10 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-1 h-4 bg-brand-ink"></div>
              <h2 className="text-3xl font-serif font-bold text-brand-ink">Recent Consignments</h2>
            </div>
            <p className="text-sm text-brand-ink/40 font-serif italic">Reviewing the latest high-value acquisitions and trades.</p>
          </div>
          <Link 
            to="/orders"
            className="relative z-10 bg-white border border-brand-clay text-brand-ink px-10 py-4 rounded-sm text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-brand-ink hover:text-white transition-all shadow-sm hover:shadow-xl active:scale-95"
          >
            Access Logistics Archive
          </Link>
          <div className="absolute top-0 right-0 text-[10rem] font-serif font-bold text-brand-clay/5 leading-none translate-x-1/4 -translate-y-1/4 pointer-events-none">録</div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-brand-paper/30 border-b border-brand-clay">
                <th className="px-12 py-6 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40">Registry ID</th>
                <th className="px-12 py-6 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40">Collector Identity</th>
                <th className="px-12 py-6 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40">Valuation</th>
                <th className="px-12 py-6 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40">Status Registry</th>
                <th className="px-12 py-6 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40 text-right">Logged Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-clay/40">
              <AnimatePresence mode="popLayout">
                {stats?.recent_orders?.map((order: any, index: number) => (
                  <motion.tr 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.1 + (index * 0.1) }}
                    key={order.id} 
                    className="hover:bg-brand-paper/40 transition-all duration-300 group"
                  >
                    <td className="px-12 py-8">
                      <span className="text-xs font-mono font-bold text-brand-red bg-brand-red/5 px-3 py-1.5 rounded-sm border border-brand-red/10">#{order.id}</span>
                    </td>
                    <td className="px-12 py-8">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-brand-ink group-hover:text-brand-red transition-colors duration-500">{order.user_details?.email || 'Anonymous Guest'}</span>
                        <span className="text-[10px] text-brand-ink/40 uppercase tracking-[0.2em] mt-1 font-bold">
                          {order.user_details?.first_name || 'Legacy'} {order.user_details?.last_name || 'Client'}
                        </span>
                      </div>
                    </td>
                    <td className="px-12 py-8">
                      <span className="text-sm font-bold text-brand-ink group-hover:scale-105 inline-block transition-transform">${parseFloat(order.total_amount).toLocaleString()}</span>
                    </td>
                    <td className="px-12 py-8">
                      <span className={cn(
                        "text-[10px] px-4 py-1.5 rounded-sm font-bold uppercase tracking-[0.2em] border inline-flex items-center gap-2",
                        order.status === 'delivered' ? "bg-emerald-50 border-emerald-100 text-emerald-700" : 
                        order.status === 'cancelled' ? "bg-red-50 border-brand-red/10 text-brand-red" : "bg-amber-50 border-amber-100 text-amber-700"
                      )}>
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          order.status === 'delivered' ? "bg-emerald-500" : 
                          order.status === 'cancelled' ? "bg-brand-red" : "bg-amber-500 animate-pulse"
                        )}></div>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-12 py-8 text-right">
                      <span className="text-xs text-brand-ink/40 font-medium font-serif italic">
                        {new Date(order.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {(!stats?.recent_orders || stats.recent_orders.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-12 py-32 text-center">
                    <div className="flex flex-col items-center gap-4 text-brand-ink/20">
                      <ShoppingBag size={48} strokeWidth={1} />
                      <p className="font-serif italic text-2xl">The consignment archive is currently empty.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
