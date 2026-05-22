import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';

interface DateRangeModalProps {
  isOpen: boolean;
  startDate: string;
  endDate: string;
  onClose: () => void;
  onApply: (start: string, end: string) => void;
}

const PRESETS = [
  { label: 'Hôm nay', days: 0 },
  { label: '7 ngày qua', days: 7 },
  { label: '30 ngày qua', days: 30 },
  { label: 'Tháng này', type: 'thisMonth' as const },
  { label: 'Năm nay', type: 'thisYear' as const },
];

export function DateRangeModal({ isOpen, startDate, endDate, onClose, onApply }: DateRangeModalProps) {
  const { t } = useTranslation();
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);

  useEffect(() => {
    if (isOpen) {
      setTempStartDate(startDate);
      setTempEndDate(endDate);
    }
  }, [isOpen, startDate, endDate]);

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    const end = new Date();
    let start = new Date();
    if ('type' in preset && preset.type === 'thisMonth') {
      start = new Date(end.getFullYear(), end.getMonth(), 1);
    } else if ('type' in preset && preset.type === 'thisYear') {
      start = new Date(end.getFullYear(), 0, 1);
    } else if ('days' in preset) {
      start.setDate(end.getDate() - preset.days);
    }
    setTempStartDate(start.toISOString().split('T')[0]);
    setTempEndDate(end.toISOString().split('T')[0]);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white border border-brand-clay w-full max-w-md shadow-2xl rounded-sm overflow-hidden"
        >
          <div className="p-6 border-b border-brand-clay flex items-center justify-between bg-brand-paper">
            <h3 className="text-xs font-bold uppercase tracking-widest text-brand-ink">
              {t('dashboard.current_period')}
            </h3>
            <button onClick={onClose} className="text-brand-ink/40 hover:text-brand-ink transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-8 space-y-8">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] uppercase tracking-widest font-bold text-brand-ink/40 block">
                  Từ ngày
                </label>
                <input
                  type="date"
                  value={tempStartDate}
                  onChange={(e) => setTempStartDate(e.target.value)}
                  className="w-full bg-brand-paper border border-brand-clay px-4 py-3 text-sm font-bold text-brand-ink rounded-sm outline-none focus:border-brand-red transition-all"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] uppercase tracking-widest font-bold text-brand-ink/40 block">
                  Đến ngày
                </label>
                <input
                  type="date"
                  value={tempEndDate}
                  onChange={(e) => setTempEndDate(e.target.value)}
                  className="w-full bg-brand-paper border border-brand-clay px-4 py-3 text-sm font-bold text-brand-ink rounded-sm outline-none focus:border-brand-red transition-all"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-4">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-brand-ink/60 border border-brand-clay hover:border-brand-red hover:text-brand-red rounded-sm transition-all"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 bg-brand-paper border-t border-brand-clay flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-ink/40 hover:text-brand-ink transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={() => {
                onApply(tempStartDate, tempEndDate);
                onClose();
              }}
              className="flex-1 bg-brand-red text-white px-6 py-3 text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-brand-red/90 shadow-lg shadow-brand-red/20 transition-all"
            >
              Áp dụng
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
