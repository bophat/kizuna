import React from 'react';
import { Package, Filter, Image as ImageIcon, Edit, X, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { getMediaUrl } from '../../lib/api';
import type { ProductFormData } from '../../features/inventory/types';
import { PRODUCT_ATTRIBUTE_FLAGS } from '../../features/inventory/constants';
import { PricingCalculator } from './PricingCalculator';
import { useFormatPrice } from '../../hooks/useFormatPrice';

interface ProductFormModalProps {
  isOpen: boolean;
  currentStep: number;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  editingProduct: any;
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  categories: any[];
  previewUrl: string | null;
  isDragging: boolean;
  onClose: () => void;
  onSubmit: (e?: React.FormEvent) => void;
  onImageChange: (file: File) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

const STEPS = [
  { number: 1, icon: Package, key: 'inventory.modal.steps.identity' },
  { number: 2, icon: Filter, key: 'inventory.modal.steps.logistics' },
  { number: 3, icon: ImageIcon, key: 'inventory.modal.steps.imagery' },
  { number: 4, icon: Edit, key: 'inventory.modal.steps.narrative' },
];

export function ProductFormModal({
  isOpen,
  currentStep,
  setCurrentStep,
  editingProduct,
  formData,
  setFormData,
  categories,
  previewUrl,
  isDragging,
  onClose,
  onSubmit,
  onImageChange,
  onDragOver,
  onDragLeave,
  onDrop,
}: ProductFormModalProps) {
  const { t } = useTranslation();
  const { format: formatPrice, formatUsd } = useFormatPrice();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-brand-ink/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className={cn(
            'relative w-full bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]',
            currentStep === 2 ? 'max-w-5xl' : 'max-w-4xl'
          )}
        >
          <div className="p-6 border-b border-brand-clay flex justify-between items-center bg-brand-paper/50">
            <div className="flex items-center gap-6">
              <h2 className="text-2xl font-serif font-bold">
                {editingProduct ? t('inventory.modal.update_title') : t('inventory.modal.new_title')}
              </h2>
              <div className="flex items-center gap-2">
                {STEPS.map((step) => (
                  <div key={step.number} className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all',
                        currentStep === step.number
                          ? 'bg-brand-red text-white scale-110 shadow-lg shadow-brand-red/20'
                          : currentStep > step.number
                            ? 'bg-brand-ink text-white'
                            : 'bg-brand-clay/30 text-brand-ink/30'
                      )}
                    >
                      {step.number}
                    </div>
                    {step.number < 4 && <div className="w-4 h-[1px] bg-brand-clay" />}
                  </div>
                ))}
              </div>
            </div>
            <button onClick={onClose} className="text-brand-ink/40 hover:text-brand-red transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-brand-paper/5">
            <form onSubmit={onSubmit} className="p-8">
              <AnimatePresence mode="wait">
                {currentStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    className="space-y-8"
                  >
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-[0.2em] text-brand-ink/40 font-bold">
                          {t('inventory.modal.id_label')}
                        </label>
                        <input
                          required
                          disabled={!!editingProduct}
                          className="w-full px-4 py-3 bg-white border border-brand-clay rounded-sm text-sm font-medium focus:outline-none focus:ring-4 focus:ring-brand-red/5 focus:border-brand-red transition-all disabled:bg-brand-paper/50"
                          value={formData.id}
                          onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-[0.2em] text-brand-ink/40 font-bold">
                          {t('inventory.modal.category_label')}
                        </label>
                        <select
                          required
                          className="w-full px-4 py-3 bg-white border border-brand-clay rounded-sm text-sm font-medium focus:outline-none focus:border-brand-red transition-all appearance-none cursor-pointer"
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        >
                          <option value="" disabled>
                            {t('inventory.modal.category_placeholder')}
                          </option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-brand-ink/40 font-bold">
                        {t('inventory.modal.name_label')}
                      </label>
                      <input
                        required
                        className="w-full px-6 py-4 bg-white border border-brand-clay rounded-sm text-lg font-serif font-bold text-brand-ink focus:outline-none focus:ring-4 focus:ring-brand-red/5 focus:border-brand-red transition-all shadow-sm"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-brand-ink/40 font-bold">
                        {t('inventory.modal.attributes_label')}
                      </label>
                      <div className="grid grid-cols-4 gap-4">
                        {PRODUCT_ATTRIBUTE_FLAGS.map((flag) => (
                          <label
                            key={flag.id}
                            className={cn(
                              'flex flex-col items-center justify-center gap-3 p-4 rounded-sm border transition-all cursor-pointer group',
                              formData[flag.id]
                                ? 'bg-brand-red/5 border-brand-red text-brand-red'
                                : 'bg-white border-brand-clay text-brand-ink/40 hover:border-brand-ink/20'
                            )}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-widest">{flag.label}</span>
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={formData[flag.id]}
                              onChange={(e) => setFormData({ ...formData, [flag.id]: e.target.checked })}
                            />
                            <div
                              className={cn(
                                'w-2 h-2 rounded-full',
                                formData[flag.id] ? 'bg-brand-red animate-pulse' : 'bg-brand-clay'
                              )}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {currentStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    className="space-y-6"
                  >
                    <PricingCalculator
                      onApplyPrice={(usd) => setFormData({ ...formData, price: usd })}
                    />

                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-[0.2em] text-brand-ink/40 font-bold">
                          {t('inventory.modal.price_label')}
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-ink/40 font-bold text-xs">
                            USD
                          </span>
                          <input
                            required
                            type="number"
                            step="0.01"
                            className="w-full pl-14 pr-4 py-3 bg-white border border-brand-clay rounded-sm text-sm font-medium focus:outline-none focus:ring-4 focus:ring-brand-red/5 focus:border-brand-red transition-all"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          />
                        </div>
                        {formData.price && (
                          <p className="text-xs text-brand-ink/60 tabular-nums">
                            {t('inventory.modal.price_preview', {
                              localized: formatPrice(formData.price),
                              usd: formatUsd(formData.price),
                            })}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-[0.2em] text-brand-ink/40 font-bold">
                          {t('inventory.modal.stock_label')}
                        </label>
                        <input
                          required
                          type="number"
                          className="w-full px-4 py-3 bg-white border border-brand-clay rounded-sm text-sm font-medium focus:outline-none focus:ring-4 focus:ring-brand-red/5 focus:border-brand-red transition-all"
                          value={formData.stock}
                          onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-[0.2em] text-brand-ink/40 font-bold">
                          {t('inventory.modal.brand_label')}
                        </label>
                        <input
                          className="w-full px-4 py-3 bg-white border border-brand-clay rounded-sm text-sm font-medium focus:outline-none focus:ring-4 focus:ring-brand-red/5 focus:border-brand-red transition-all"
                          value={formData.brand}
                          onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-[0.2em] text-brand-ink/40 font-bold">
                          {t('inventory.modal.location_label')}
                        </label>
                        <input
                          className="w-full px-4 py-3 bg-white border border-brand-clay rounded-sm text-sm font-medium focus:outline-none focus:ring-4 focus:ring-brand-red/5 focus:border-brand-red transition-all"
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {currentStep === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    className="space-y-4"
                  >
                    <label className="text-[10px] uppercase tracking-[0.2em] text-brand-ink/40 font-bold">
                      {t('inventory.modal.image_label')}
                    </label>
                    <div
                      onDragOver={onDragOver}
                      onDragLeave={onDragLeave}
                      onDrop={onDrop}
                      className={cn(
                        'relative aspect-[21/9] rounded-sm border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all duration-500',
                        isDragging ? 'border-brand-red bg-brand-red/5 scale-[1.02]' : 'border-brand-clay bg-white',
                        previewUrl && 'border-solid'
                      )}
                    >
                      {previewUrl ? (
                        <>
                          <img src={getMediaUrl(previewUrl)} className="w-full h-full object-cover" alt="" />
                          <div className="absolute inset-0 bg-brand-ink/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                            <label className="cursor-pointer bg-white text-brand-ink px-8 py-4 rounded-sm text-xs font-bold uppercase tracking-widest flex items-center gap-3 shadow-2xl hover:bg-brand-red hover:text-white transition-all">
                              <Upload size={16} />
                              {t('inventory.modal.image_update')}
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => e.target.files && onImageChange(e.target.files[0])}
                              />
                            </label>
                          </div>
                        </>
                      ) : (
                        <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center gap-6 text-brand-ink/20 hover:text-brand-red/40 transition-all group">
                          <div className="p-8 bg-brand-paper rounded-full shadow-inner group-hover:scale-110 transition-transform duration-700 border border-brand-clay/30">
                            <ImageIcon size={64} strokeWidth={1} />
                          </div>
                          <div className="text-center space-y-2">
                            <span className="block text-xs font-bold uppercase tracking-[0.3em]">
                              {t('inventory.modal.drop_asset')}
                            </span>
                            <span className="block text-[10px] italic">{t('inventory.modal.click_browse')}</span>
                          </div>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => e.target.files && onImageChange(e.target.files[0])}
                          />
                        </label>
                      )}
                    </div>
                  </motion.div>
                )}

                {currentStep === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-brand-ink/40 font-bold">
                        {t('inventory.modal.description_title')}
                      </label>
                      <p className="text-[10px] text-brand-ink/30 italic mb-4">{t('inventory.modal.description_help')}</p>
                      <textarea
                        rows={10}
                        placeholder={t('inventory.modal.description_placeholder')}
                        className="w-full px-6 py-5 bg-white border border-brand-clay rounded-sm text-base font-serif italic text-brand-ink/80 focus:outline-none focus:ring-4 focus:ring-brand-red/5 focus:border-brand-red transition-all resize-none shadow-inner"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </div>

          <div className="p-6 bg-brand-paper/50 border-t border-brand-clay flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-brand-ink/40 hover:text-brand-red transition-colors"
            >
              {t('inventory.modal.cancel')}
            </button>
            <div className="flex items-center gap-4">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => prev - 1)}
                  className="px-8 py-3 border border-brand-clay rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all"
                >
                  {t('inventory.modal.prev')}
                </button>
              )}
              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => prev + 1)}
                  className="px-12 py-3 bg-brand-ink text-white rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-brand-red transition-all shadow-xl hover:shadow-brand-red/20"
                >
                  {t('inventory.modal.next')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSubmit()}
                  className="px-12 py-3 bg-brand-red text-white rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-brand-ink transition-all shadow-xl shadow-brand-red/10"
                >
                  {editingProduct ? t('inventory.modal.finalize') : t('inventory.modal.confirm')}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
