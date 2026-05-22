import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

interface PaginationProps {
  totalItems: number;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  start: number;
  end: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (size: number) => void;
  variant?: 'default' | 'inventory';
  rangeDefaultValue?: string;
}

export function Pagination({
  totalItems,
  currentPage,
  totalPages,
  itemsPerPage,
  start,
  end,
  onPageChange,
  onItemsPerPageChange,
  variant = 'default',
  rangeDefaultValue = 'Showing {{start}}-{{end}} of {{total}}',
}: PaginationProps) {
  const { t } = useTranslation();
  const isInventory = variant === 'inventory';

  if (totalItems === 0) return null;

  return (
    <div
      className={cn(
        'border-t border-brand-clay flex flex-col sm:flex-row justify-between items-center bg-brand-paper/10',
        isInventory ? 'p-6 gap-6' : 'p-4 gap-4'
      )}
    >
      <div className={cn('flex items-center', isInventory ? 'gap-4' : 'gap-4')}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-ink/40">
          {t('filter.show_per_page', { defaultValue: 'Show' })}:
        </p>
        <div className={cn('flex', isInventory ? 'gap-2' : 'gap-1')}>
          {[10, 20, 50].map((size) => (
            <button
              key={size}
              onClick={() => onItemsPerPageChange(size)}
              className={cn(
                'font-bold transition-all border',
                isInventory
                  ? 'px-4 py-2 rounded-sm text-[10px]'
                  : 'px-3 py-1 rounded text-[10px]',
                itemsPerPage === size
                  ? 'bg-brand-ink border-brand-ink text-white'
                  : 'bg-white border-brand-clay text-brand-ink/60 hover:border-brand-ink',
                isInventory && itemsPerPage === size && 'shadow-lg shadow-brand-ink/10'
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div className={cn('flex items-center', isInventory ? 'gap-3' : 'gap-2')}>
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className={cn(
            'transition-all text-brand-ink/40 hover:text-brand-red disabled:opacity-30 disabled:cursor-not-allowed',
            isInventory
              ? 'p-3 bg-white border border-brand-clay rounded-sm hover:shadow-md'
              : 'p-2 hover:bg-brand-clay rounded-md'
          )}
        >
          <ChevronLeft size={isInventory ? 18 : 16} />
        </button>

        <div className={cn('flex items-center', isInventory ? 'gap-2' : 'gap-1')}>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => {
              if (totalPages <= 5) return true;
              return p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1;
            })
            .map((p, i, arr) => (
              <React.Fragment key={p}>
                {i > 0 && arr[i - 1] !== p - 1 && (
                  <span className="px-1 text-brand-ink/20">...</span>
                )}
                <button
                  onClick={() => onPageChange(p)}
                  className={cn(
                    'font-bold transition-all',
                    isInventory
                      ? 'w-10 h-10 rounded-sm text-xs border'
                      : 'w-8 h-8 rounded text-[10px]',
                    currentPage === p
                      ? isInventory
                        ? 'bg-brand-red border-brand-red text-white shadow-lg shadow-brand-red/20'
                        : 'bg-brand-red text-white'
                      : isInventory
                        ? 'bg-white border-brand-clay text-brand-ink/60 hover:border-brand-ink'
                        : 'text-brand-ink/60 hover:bg-brand-clay'
                  )}
                >
                  {p}
                </button>
              </React.Fragment>
            ))}
        </div>

        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          className={cn(
            'transition-all text-brand-ink/40 hover:text-brand-red disabled:opacity-30 disabled:cursor-not-allowed',
            isInventory
              ? 'p-3 bg-white border border-brand-clay rounded-sm hover:shadow-md'
              : 'p-2 hover:bg-brand-clay rounded-md'
          )}
        >
          <ChevronRight size={isInventory ? 18 : 16} />
        </button>
      </div>

      <p
        className={cn(
          'text-brand-ink/40',
          isInventory
            ? 'text-xs font-serif italic'
            : 'text-[10px] font-bold uppercase tracking-widest italic'
        )}
      >
        {t('filter.showing_range', {
          defaultValue: rangeDefaultValue,
          start,
          end,
          total: totalItems,
        })}
      </p>
    </div>
  );
}
