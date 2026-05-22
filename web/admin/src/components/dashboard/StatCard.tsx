import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { useFormatPrice } from '../../hooks/useFormatPrice';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  trend?: string;
  isCurrency?: boolean;
  delay?: number;
}

export function StatCard({ title, value, icon: Icon, trend, isCurrency, delay = 0 }: StatCardProps) {
  const { format: formatPrice } = useFormatPrice();

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
          <div
            className={cn(
              'flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full',
              trend.startsWith('+') ? 'text-emerald-600 bg-emerald-50' : 'text-brand-red bg-brand-red/5'
            )}
          >
            {trend.startsWith('+') ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {trend}
          </div>
        )}
      </div>
      <div className="relative z-10">
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40 mb-1">{title}</p>
        <h3 className="text-3xl font-serif font-bold text-brand-ink tracking-tight">
          {isCurrency
            ? formatPrice(value ?? 0)
            : value?.toLocaleString() || '0'}
        </h3>
      </div>
      <div className="absolute -right-4 -bottom-4 text-brand-clay/5 group-hover:text-brand-clay/10 transition-colors duration-700">
        <Icon size={120} strokeWidth={1} />
      </div>
    </motion.div>
  );
}
