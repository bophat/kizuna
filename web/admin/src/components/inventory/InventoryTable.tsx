import { Package, Search, Edit, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { getMediaUrl } from '../../lib/api';
import { ValuationCell } from '../common/ValuationCell';

interface InventoryTableProps {
  products: any[];
  onEdit: (product: any) => void;
  onDelete: (id: string) => void;
  onStatusChange: (product: any, nextStatus: string) => void;
  updatingStatusId: string | null;
}

export function InventoryTable({
  products,
  onEdit,
  onDelete,
  onStatusChange,
  updatingStatusId,
}: InventoryTableProps) {
  const { t } = useTranslation();

  if (products.length === 0) {
    return (
      <tr>
        <td colSpan={6} className="px-6 py-20 text-center">
          <div className="flex flex-col items-center gap-2 text-brand-ink/30">
            <Search size={40} strokeWidth={1} />
            <p className="font-serif italic">{t('inventory.table.empty')}</p>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <AnimatePresence mode="popLayout">
      {products.map((product) => (
        <motion.tr
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          key={product.id}
          className="hover:bg-brand-paper/30 transition-all duration-300 group"
        >
          <td className="px-8 py-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-sm overflow-hidden bg-brand-clay/10 border border-brand-clay/50 flex-shrink-0 relative">
                {product.image ? (
                  <img
                    src={getMediaUrl(product.image)}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-brand-ink/10">
                    <Package size={24} strokeWidth={1} />
                  </div>
                )}
                {(product.is_featured || product.is_new) && (
                  <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                    {product.is_featured && (
                      <div className="absolute top-1 right-1 w-2 h-2 bg-brand-red rounded-full shadow-sm" />
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-base font-serif font-bold text-brand-ink group-hover:text-brand-red transition-colors">
                  {product.name}
                </p>
                <p className="text-xs text-brand-ink/40 font-medium tracking-wide">
                  {product.brand || t('inventory.table.unknown_artisan')}
                </p>
                <span
                  className={cn(
                    'inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                    product.status === 'published'
                      ? 'bg-emerald-100 text-emerald-700'
                      : product.status === 'suspended'
                        ? 'bg-red-100 text-red-700'
                        : product.status === 'review'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700',
                  )}
                >
                  {t(`inventory.status.${product.status || 'draft'}`)}
                </span>
              </div>
            </div>
          </td>
          <td className="px-8 py-6">
            <span className="text-[10px] font-mono bg-brand-clay/20 text-brand-ink/60 px-2 py-1 rounded-sm border border-brand-clay/30 uppercase tracking-tighter">
              {product.id}
            </span>
          </td>
          <td className="px-8 py-6">
            <span className="text-xs font-bold text-brand-ink/70">{product.category_name}</span>
          </td>
          <td className="px-8 py-6">
            <ValuationCell amountUsd={product.price} />
          </td>
          <td className="px-8 py-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-24 h-1.5 bg-brand-clay rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((product.stock / 50) * 100, 100)}%` }}
                  className={cn(
                    'h-full rounded-full transition-all duration-1000',
                    product.stock > 10 ? 'bg-emerald-500' : product.stock > 0 ? 'bg-amber-500' : 'bg-brand-red'
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-[10px] font-bold uppercase tracking-widest',
                  product.stock > 10 ? 'text-emerald-600' : product.stock > 0 ? 'text-amber-600' : 'text-brand-red'
                )}
              >
                {product.stock > 0
                  ? `${product.stock} ${t('inventory.table.in_storage')}`
                  : t('inventory.table.depleted')}
              </span>
            </div>
          </td>
          <td className="px-8 py-6 text-right">
            <div className="flex justify-end gap-3 transition-all duration-300">
              <button
                onClick={() => onStatusChange(
                  product,
                  product.status === 'published' ? 'suspended' : 'published',
                )}
                disabled={updatingStatusId === product.id}
                className={cn(
                  'p-2.5 border rounded-sm transition-all shadow-sm hover:shadow-md disabled:cursor-wait disabled:opacity-50',
                  product.status === 'published'
                    ? 'bg-white border-brand-clay text-amber-700 hover:bg-amber-600 hover:text-white'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-600 hover:text-white',
                )}
                title={product.status === 'published'
                  ? t('inventory.table.suspend')
                  : t('inventory.table.publish')}
              >
                {updatingStatusId === product.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : product.status === 'published' ? (
                  <EyeOff size={16} />
                ) : (
                  <Eye size={16} />
                )}
              </button>
              <button
                onClick={() => onEdit(product)}
                className="p-2.5 bg-white border border-brand-clay text-brand-ink hover:bg-brand-ink hover:text-white rounded-sm transition-all shadow-sm hover:shadow-md"
                title={t('inventory.table.refine')}
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => onDelete(product.id)}
                className="p-2.5 bg-white border border-brand-clay text-brand-red hover:bg-brand-red hover:text-white rounded-sm transition-all shadow-sm hover:shadow-md"
                title={t('inventory.table.decommission')}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </td>
        </motion.tr>
      ))}
    </AnimatePresence>
  );
}
