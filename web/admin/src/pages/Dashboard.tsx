/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
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
  Activity,
  X
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
import { useTranslation } from 'react-i18next';

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
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        const url = `/stats/?start_date=${startDate}&end_date=${endDate}`;
        const response = await apiFetch(url);
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
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="h-[calc(100vh-80px)] flex flex-col items-center justify-center gap-6 bg-brand-paper/30">
        <div className="relative">
          <Loader2 className="w-12 h-12 animate-spin text-brand-red" />
          <div className="absolute inset-0 blur-xl bg-brand-red/20 animate-pulse rounded-full"></div>
        </div>
        <div className="flex flex-col items-center">
          <p className="text-lg font-serif italic text-brand-ink">{t('common.loading')}</p>
          <p className="text-[10px] uppercase tracking-[0.3em] text-brand-ink/30 mt-2 font-bold">{t('common.admin_core')}</p>
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
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-red">{t('dashboard.overview')}</span>
          </div>
          <h1 className="text-5xl font-serif font-bold text-brand-ink mb-4">{t('dashboard.title')}</h1>
          <p className="text-brand-ink/40 font-serif italic max-w-lg">
            {t('dashboard.description')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-4">
          <button 
            onClick={() => {
              setTempStartDate(startDate);
              setTempEndDate(endDate);
              setIsRangeModalOpen(true);
            }}
            className="flex items-center gap-4 bg-white border border-brand-clay p-4 rounded-sm shadow-sm w-full md:w-auto hover:border-brand-red/30 hover:shadow-md transition-all group"
          >
            <Calendar size={18} className="text-brand-ink/30 group-hover:text-brand-red transition-colors" />
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest font-bold text-brand-ink/40 mb-1">{t('dashboard.current_period')}</p>
              <p className="text-xs font-bold text-brand-ink">
                {new Date(startDate).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })}
                <span className="mx-2 text-brand-ink/30">—</span>
                {new Date(endDate).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </button>
        </div>

        {/* Date Range Modal */}
        <AnimatePresence>
          {isRangeModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsRangeModalOpen(false)}
                className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white border border-brand-clay w-full max-w-md shadow-2xl rounded-sm overflow-hidden"
              >
                <div className="p-6 border-b border-brand-clay flex items-center justify-between bg-brand-paper">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-brand-ink">{t('dashboard.current_period')}</h3>
                  <button onClick={() => setIsRangeModalOpen(false)} className="text-brand-ink/40 hover:text-brand-ink transition-colors">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="p-8 space-y-8">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-brand-ink/40 block">Từ ngày</label>
                      <input 
                        type="date"
                        value={tempStartDate}
                        onChange={(e) => setTempStartDate(e.target.value)}
                        className="w-full bg-brand-paper border border-brand-clay px-4 py-3 text-sm font-bold text-brand-ink rounded-sm outline-none focus:border-brand-red transition-all"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-brand-ink/40 block">Đến ngày</label>
                      <input 
                        type="date"
                        value={tempEndDate}
                        onChange={(e) => setTempEndDate(e.target.value)}
                        className="w-full bg-brand-paper border border-brand-clay px-4 py-3 text-sm font-bold text-brand-ink rounded-sm outline-none focus:border-brand-red transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-4">
                    {[
                      { label: 'Hôm nay', days: 0 },
                      { label: '7 ngày qua', days: 7 },
                      { label: '30 ngày qua', days: 30 },
                      { label: 'Tháng này', type: 'thisMonth' },
                      { label: 'Năm nay', type: 'thisYear' }
                    ].map((preset: any) => (
                      <button
                        key={preset.label}
                        onClick={() => {
                          const end = new Date();
                          let start = new Date();
                          if (preset.type === 'thisMonth') {
                            start = new Date(end.getFullYear(), end.getMonth(), 1);
                          } else if (preset.type === 'thisYear') {
                            start = new Date(end.getFullYear(), 0, 1);
                          } else {
                            start.setDate(end.getDate() - preset.days);
                          }
                          setTempStartDate(start.toISOString().split('T')[0]);
                          setTempEndDate(end.toISOString().split('T')[0]);
                        }}
                        className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-brand-ink/60 border border-brand-clay hover:border-brand-red hover:text-brand-red rounded-sm transition-all"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-6 bg-brand-paper border-t border-brand-clay flex gap-3">
                  <button 
                    onClick={() => setIsRangeModalOpen(false)}
                    className="flex-1 px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-ink/40 hover:text-brand-ink transition-colors"
                  >
                    Hủy
                  </button>
                  <button 
                    onClick={() => {
                      setStartDate(tempStartDate);
                      setEndDate(tempEndDate);
                      setIsRangeModalOpen(false);
                    }}
                    className="flex-1 bg-brand-red text-white px-6 py-3 text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-brand-red/90 shadow-lg shadow-brand-red/20 transition-all"
                  >
                    Áp dụng
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* StatCards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title={t('dashboard.stats.total_acquisitions')} 
          value={stats?.total_revenue || 0} 
          icon={TrendingUp} 
          trend="+12.5%" 
          isCurrency 
          delay={0.1}
        />
        <StatCard 
          title={t('dashboard.stats.active_collectors')} 
          value={stats?.total_users || 0} 
          icon={Users} 
          trend="+5.2%" 
          delay={0.2}
        />
        <StatCard 
          title={t('dashboard.stats.total_trades')} 
          value={stats?.total_orders || 0} 
          icon={ShoppingBag} 
          trend="+8.1%" 
          delay={0.3}
        />
        <StatCard 
          title={t('dashboard.stats.archive_size')} 
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
                <h2 className="text-3xl font-serif font-bold text-brand-ink">{t('dashboard.charts.trade_performance')}</h2>
              </div>
              <p className="text-sm text-brand-ink/40 font-serif italic">{t('dashboard.charts.trade_description')}</p>
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
              <h2 className="text-2xl font-serif font-bold text-brand-ink">{t('dashboard.charts.collection_shares')}</h2>
            </div>
            <p className="text-xs text-brand-ink/40 font-serif italic">{t('dashboard.charts.collection_description')}</p>
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
                <h2 className="text-3xl font-serif font-bold text-brand-ink">{t('dashboard.artifacts.top_artifacts')}</h2>
              </div>
              <p className="text-sm text-brand-ink/40 font-serif italic">{t('dashboard.artifacts.top_description')}</p>
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
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-sm">{product.sales} {t('dashboard.artifacts.sales')}</span>
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
                  <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-brand-red">{t('dashboard.system.core')}</p>
                </div>
                <h2 className="text-4xl font-serif mb-6 italic leading-tight tracking-tight">{t('dashboard.system.monitor')}</h2>
                <p className="text-brand-paper/40 text-sm font-serif leading-relaxed mb-10">
                  {t('dashboard.system.description')}
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-sm border border-white/10 group-hover:border-brand-red/40 transition-all duration-700 backdrop-blur-sm">
                    <div className="w-12 h-12 rounded-sm bg-brand-red/10 flex items-center justify-center border border-brand-red/30 shrink-0">
                      <div className="text-3xl font-serif text-brand-red">衛</div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold tracking-[0.2em] uppercase mb-1">{t('dashboard.system.guardian')}</p>
                      <p className="text-[10px] text-white/30 italic font-serif">{t('dashboard.system.registry_verified')}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-sm border border-white/10 group-hover:border-brand-red/40 transition-all duration-700 backdrop-blur-sm">
                    <div className="w-12 h-12 rounded-sm bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                      <Database size={18} className="text-brand-paper/40" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold tracking-[0.2em] uppercase mb-1">{t('dashboard.system.repository')}</p>
                      <p className="text-[10px] text-white/30 italic font-serif">{t('dashboard.system.sqlite_connected')}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-10 pt-8 border-t border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                  <span className="text-[10px] font-mono text-white/40 italic">{t('dashboard.system.secure_session')}</span>
                </div>
                <ArrowUpRight size={18} className="text-white/20 group-hover:text-brand-red transition-colors" />
              </div>
            </div>
            
            <div className="absolute top-0 right-0 w-48 h-48 bg-brand-red/10 blur-[80px] rounded-full pointer-events-none"></div>
          </motion.div>

          <div className="space-y-4">
            <p className="text-[10px] uppercase font-bold text-brand-ink/30 tracking-[0.3em] ml-2 mb-4">{t('dashboard.logistics.quick')}</p>
            <QuickAction title={t('dashboard.logistics.catalog')} icon={Plus} link="/inventory" delay={0.7} />
            <QuickAction title={t('dashboard.logistics.review')} icon={ShoppingBag} link="/orders" delay={0.8} />
            <QuickAction title={t('dashboard.logistics.management')} icon={Users} link="/users" delay={0.9} />
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
              <h2 className="text-3xl font-serif font-bold text-brand-ink">{t('dashboard.logistics.recent')}</h2>
            </div>
            <p className="text-sm text-brand-ink/40 font-serif italic">{t('dashboard.logistics.recent_description')}</p>
          </div>
          <Link 
            to="/orders"
            className="relative z-10 bg-white border border-brand-clay text-brand-ink px-10 py-4 rounded-sm text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-brand-ink hover:text-white transition-all shadow-sm hover:shadow-xl active:scale-95"
          >
            {t('dashboard.logistics.access_archive')}
          </Link>
          <div className="absolute top-0 right-0 text-[10rem] font-serif font-bold text-brand-clay/5 leading-none translate-x-1/4 -translate-y-1/4 pointer-events-none">録</div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-brand-paper/30 border-b border-brand-clay">
                <th className="px-12 py-6 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40">{t('dashboard.table.id')}</th>
                <th className="px-12 py-6 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40">{t('dashboard.table.collector')}</th>
                <th className="px-12 py-6 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40">{t('dashboard.table.valuation')}</th>
                <th className="px-12 py-6 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40">{t('dashboard.table.status')}</th>
                <th className="px-12 py-6 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40 text-right">{t('dashboard.table.date')}</th>
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
                        {t(`orders.status.${order.status}`)}
                      </span>
                    </td>
                    <td className="px-12 py-8 text-right">
                      <span className="text-xs text-brand-ink/40 font-medium font-serif italic">
                        {new Date(order.created_at).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' })}
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
                      <p className="font-serif italic text-2xl">{t('dashboard.table.empty')}</p>
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
