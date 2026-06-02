import React, { useState, useCallback, useMemo } from 'react';
import {
  FileSpreadsheet,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Weight,
  Package,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { apiFetch } from '../../lib/api';

interface CsvRow {
  Name: string;
  Brand: string;
  SKU: string;
  Price: string;
  'Original Price': string;
  Discount: string;
  Category: string;
  Rating: string;
  'Review Count': string;
  Shipping: string;
  Seller: string;
  'Main Image': string;
  'All Images': string;
  URL: string;
  'Scraped At': string;
  // Added by user in preview
  Weight: string;
  selected: boolean;
}

interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
  total_rows: number;
}

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ===== PRICING HELPERS =====
function parseJpyPrice(priceStr: string): number | null {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[円¥,\s\u3000]/g, '');
  const match = cleaned.match(/[\d]+(?:\.[\d]+)?/);
  return match ? parseFloat(match[0]) : null;
}

function calculateSellingPriceVnd(priceJpy: number | null, weightKg: number): number | null {
  if (priceJpy === null) return null;
  const importPriceVnd = (priceJpy + 1000) * 200;
  const shippingVnd = weightKg > 0.5 ? weightKg * 180000 : 20000;
  return importPriceVnd * 1.15 + shippingVnd;
}

function formatVndShort(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M₫`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}K₫`;
  return `${Math.round(amount)}₫`;
}

function formatVndFull(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

// ===== CSV PARSER =====
function parseCsvContent(content: string): CsvRow[] {
  // Remove BOM
  const clean = content.replace(/^\uFEFF/, '');
  const lines = clean.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim();
    });

    rows.push({
      Name: row['Name'] || '',
      Brand: row['Brand'] || '',
      SKU: row['SKU'] || '',
      Price: row['Price'] || '',
      'Original Price': row['Original Price'] || '',
      Discount: row['Discount'] || '',
      Category: row['Category'] || '',
      Rating: row['Rating'] || '',
      'Review Count': row['Review Count'] || '',
      Shipping: row['Shipping'] || '',
      Seller: row['Seller'] || '',
      'Main Image': row['Main Image'] || '',
      'All Images': row['All Images'] || '',
      URL: row['URL'] || '',
      'Scraped At': row['Scraped At'] || '',
      Weight: '0.3',
      selected: true,
    });
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else if (char !== '\r') {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

// ===== STEP INDICATORS =====
const STEPS = [
  { number: 1, icon: Upload, label: 'Upload' },
  { number: 2, icon: Package, label: 'Preview' },
  { number: 3, icon: CheckCircle2, label: 'Result' },
];

export function CsvImportModal({ isOpen, onClose, onSuccess }: CsvImportModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep(1);
    setFile(null);
    setRows([]);
    setIsDragging(false);
    setImporting(false);
    setResult(null);
    setParseError(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // ===== FILE HANDLING =====
  const processFile = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setParseError(t('inventory.csv_import.error_not_csv', 'File must be a .csv file'));
      return;
    }
    setFile(f);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = parseCsvContent(content);
        if (parsed.length === 0) {
          setParseError(t('inventory.csv_import.error_empty', 'No products found in CSV'));
          return;
        }
        setRows(parsed);
        setStep(2);
      } catch {
        setParseError(t('inventory.csv_import.error_parse', 'Failed to parse CSV file'));
      }
    };
    reader.readAsText(f, 'UTF-8');
  }, [t]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) processFile(f);
    },
    [processFile]
  );

  // ===== ROW MANAGEMENT =====
  const selectedRows = useMemo(() => rows.filter((r) => r.selected), [rows]);

  const toggleRow = useCallback((idx: number) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)));
  }, []);

  const toggleAll = useCallback((checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  }, []);

  const updateWeight = useCallback((idx: number, weight: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, Weight: weight } : r)));
  }, []);

  const removeRow = useCallback((idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ===== IMPORT =====
  const handleImport = useCallback(async () => {
    if (selectedRows.length === 0) return;
    setImporting(true);

    try {
      // Build CSV with Weight column added
      const headers = [
        'Name', 'Brand', 'SKU', 'Price', 'Original Price', 'Discount',
        'Category', 'Rating', 'Review Count', 'Shipping', 'Seller',
        'Main Image', 'All Images', 'URL', 'Scraped At', 'Weight',
      ];

      const csvLines = [headers.join(',')];
      for (const row of selectedRows) {
        const values = headers.map((h) => {
          const val = (row as Record<string, any>)[h] || '';
          return `"${String(val).replace(/"/g, '""')}"`;
        });
        csvLines.push(values.join(','));
      }

      const csvContent = '\uFEFF' + csvLines.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const csvFile = new File([blob], 'import.csv', { type: 'text/csv' });

      const formData = new FormData();
      formData.append('csv_file', csvFile);

      const response = await apiFetch('/products/import-csv/', {
        method: 'POST',
        body: formData,
        headers: {},
      });

      if (response.ok) {
        const data: ImportResult = await response.json();
        setResult(data);
        setStep(3);
        if (data.created > 0) onSuccess();
      } else {
        const err = await response.json();
        setResult({
          created: 0,
          skipped: 0,
          errors: [err.error || 'Import failed'],
          total_rows: selectedRows.length,
        });
        setStep(3);
      }
    } catch (err) {
      setResult({
        created: 0,
        skipped: 0,
        errors: [`Network error: ${(err as Error).message}`],
        total_rows: selectedRows.length,
      });
      setStep(3);
    } finally {
      setImporting(false);
    }
  }, [selectedRows, onSuccess]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-brand-ink/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-5xl bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* ===== HEADER ===== */}
          <div className="p-6 border-b border-brand-clay flex justify-between items-center bg-brand-paper/50">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-red/10 rounded-sm">
                  <FileSpreadsheet size={20} className="text-brand-red" />
                </div>
                <h2 className="text-2xl font-serif font-bold">
                  {t('inventory.csv_import.title', 'Import from Qoo10')}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {STEPS.map((s) => (
                  <div key={s.number} className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all',
                        step === s.number
                          ? 'bg-brand-red text-white scale-110 shadow-lg shadow-brand-red/20'
                          : step > s.number
                            ? 'bg-brand-ink text-white'
                            : 'bg-brand-clay/30 text-brand-ink/30'
                      )}
                    >
                      {step > s.number ? '✓' : s.number}
                    </div>
                    {s.number < 3 && <div className="w-4 h-[1px] bg-brand-clay" />}
                  </div>
                ))}
              </div>
            </div>
            <button onClick={handleClose} className="text-brand-ink/40 hover:text-brand-red transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* ===== CONTENT ===== */}
          <div className="flex-1 overflow-y-auto bg-brand-paper/5">
            <AnimatePresence mode="wait">
              {/* ===== STEP 1: UPLOAD ===== */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  className="p-8"
                >
                  <div className="mb-6">
                    <p className="text-sm text-brand-ink/60 font-serif italic">
                      {t(
                        'inventory.csv_import.upload_desc',
                        'Upload a CSV file exported from the Qoo10 Scraper extension. Prices will be automatically calculated.'
                      )}
                    </p>
                  </div>

                  <div
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    className={cn(
                      'relative aspect-[21/9] rounded-sm border-2 border-dashed flex flex-col items-center justify-center transition-all duration-500 cursor-pointer',
                      isDragging
                        ? 'border-brand-red bg-brand-red/5 scale-[1.02]'
                        : 'border-brand-clay bg-white hover:border-brand-ink/30'
                    )}
                    onClick={() => document.getElementById('csv-file-input')?.click()}
                  >
                    <div className="flex flex-col items-center gap-6 text-brand-ink/30">
                      <div
                        className={cn(
                          'p-8 rounded-full shadow-inner border border-brand-clay/30 transition-all duration-700',
                          isDragging ? 'bg-brand-red/10 scale-110' : 'bg-brand-paper'
                        )}
                      >
                        <FileSpreadsheet size={64} strokeWidth={1} className={isDragging ? 'text-brand-red' : ''} />
                      </div>
                      <div className="text-center space-y-2">
                        <span className="block text-xs font-bold uppercase tracking-[0.3em]">
                          {t('inventory.csv_import.drop_file', 'Drop CSV File Here')}
                        </span>
                        <span className="block text-[10px] italic">
                          {t('inventory.csv_import.click_browse', 'or click to browse')}
                        </span>
                      </div>
                    </div>
                    <input
                      id="csv-file-input"
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                    />
                  </div>

                  {parseError && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 bg-red-50 border border-red-200 rounded-sm flex items-center gap-3"
                    >
                      <AlertCircle size={18} className="text-brand-red flex-shrink-0" />
                      <p className="text-sm text-brand-red">{parseError}</p>
                    </motion.div>
                  )}

                  {/* Pricing formula info */}
                  <div className="mt-6 p-4 bg-brand-paper/50 rounded-sm border border-brand-clay/50">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-red mb-2">
                      {t('inventory.csv_import.formula_title', 'Pricing Formula')}
                    </p>
                    <div className="text-xs text-brand-ink/60 space-y-1 font-mono">
                      <p>Giá nhập = (Giá gốc JPY + 1,000¥) × 200</p>
                      <p>Phí ship = {'weight > 0.5kg ? weight × 180,000₫ : 20,000₫'}</p>
                      <p>Giá bán = Giá nhập × 1.15 + Phí ship</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ===== STEP 2: PREVIEW ===== */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  className="p-6"
                >
                  {/* Stats bar */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold text-brand-ink/60">
                        {file?.name}
                      </span>
                      <span className="px-2 py-1 bg-brand-red/10 text-brand-red text-[10px] font-bold rounded-sm">
                        {selectedRows.length}/{rows.length}{' '}
                        {t('inventory.csv_import.selected', 'selected')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-xs text-brand-ink/60 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRows.length === rows.length}
                          onChange={(e) => toggleAll(e.target.checked)}
                          className="accent-brand-red"
                        />
                        {t('inventory.csv_import.select_all', 'Select all')}
                      </label>
                    </div>
                  </div>

                  {/* Product preview table */}
                  <div className="overflow-x-auto border border-brand-clay rounded-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-brand-paper/50 border-b border-brand-clay">
                          <th className="px-3 py-3 text-[10px] uppercase tracking-[0.15em] font-bold text-brand-ink/40 w-10">
                            ✓
                          </th>
                          <th className="px-3 py-3 text-[10px] uppercase tracking-[0.15em] font-bold text-brand-ink/40">
                            {t('inventory.csv_import.col_product', 'Product')}
                          </th>
                          <th className="px-3 py-3 text-[10px] uppercase tracking-[0.15em] font-bold text-brand-ink/40 w-28">
                            {t('inventory.csv_import.col_price_jpy', 'Price (JPY)')}
                          </th>
                          <th className="px-3 py-3 text-[10px] uppercase tracking-[0.15em] font-bold text-brand-ink/40 w-24">
                            <div className="flex items-center gap-1">
                              <Weight size={12} />
                              {t('inventory.csv_import.col_weight', 'Weight')}
                            </div>
                          </th>
                          <th className="px-3 py-3 text-[10px] uppercase tracking-[0.15em] font-bold text-brand-ink/40 w-28">
                            {t('inventory.csv_import.col_import_vnd', 'Import (₫)')}
                          </th>
                          <th className="px-3 py-3 text-[10px] uppercase tracking-[0.15em] font-bold text-brand-red w-32">
                            {t('inventory.csv_import.col_selling_vnd', 'Selling (₫)')}
                          </th>
                          <th className="px-3 py-3 w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-clay/50">
                        {rows.map((row, idx) => {
                          const priceJpy = parseJpyPrice(row.Price);
                          const weightKg = parseFloat(row.Weight) || 0.3;
                          const importVnd = priceJpy !== null ? (priceJpy + 1000) * 200 : null;
                          const sellingVnd = calculateSellingPriceVnd(priceJpy, weightKg);

                          return (
                            <tr
                              key={idx}
                              className={cn(
                                'transition-all duration-200',
                                row.selected
                                  ? 'bg-white hover:bg-brand-paper/30'
                                  : 'bg-brand-clay/10 opacity-50'
                              )}
                            >
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={row.selected}
                                  onChange={() => toggleRow(idx)}
                                  className="accent-brand-red"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-3">
                                  {row['Main Image'] ? (
                                    <img
                                      src={row['Main Image']}
                                      alt=""
                                      className="w-10 h-10 rounded-sm object-cover border border-brand-clay/50 flex-shrink-0"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-sm bg-brand-clay/10 flex items-center justify-center flex-shrink-0">
                                      <Package size={16} className="text-brand-ink/20" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-brand-ink truncate max-w-[240px]" title={row.Name}>
                                      {row.Name || '(no name)'}
                                    </p>
                                    <p className="text-[10px] text-brand-ink/40 truncate max-w-[200px]">
                                      {row.Brand || row.Seller || '—'} · {row.Category || '—'}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <span className="text-sm font-mono text-brand-ink/70">
                                  {priceJpy !== null ? `¥${priceJpy.toLocaleString()}` : '—'}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  value={row.Weight}
                                  onChange={(e) => updateWeight(idx, e.target.value)}
                                  className="w-20 px-2 py-1.5 text-sm bg-white border border-brand-clay rounded-sm focus:outline-none focus:border-brand-red text-center"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <span className="text-xs text-brand-ink/60 tabular-nums">
                                  {importVnd !== null ? formatVndShort(importVnd) : '—'}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                {sellingVnd !== null ? (
                                  <div>
                                    <span className="text-sm font-bold text-brand-red tabular-nums">
                                      {formatVndShort(sellingVnd)}
                                    </span>
                                    <p className="text-[9px] text-brand-ink/40 tabular-nums">
                                      {formatVndFull(sellingVnd)}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-xs text-brand-ink/30">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  onClick={() => removeRow(idx)}
                                  className="p-1 text-brand-ink/20 hover:text-brand-red transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary */}
                  {selectedRows.length > 0 && (
                    <div className="mt-4 p-4 bg-brand-ink text-white rounded-sm flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-widest opacity-60">
                          {t('inventory.csv_import.summary', 'Import Summary')}
                        </p>
                        <p className="text-sm font-bold">
                          {selectedRows.length}{' '}
                          {t('inventory.csv_import.products_ready', 'products ready to import')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-widest opacity-60">
                          {t('inventory.csv_import.total_value', 'Est. Total Value')}
                        </p>
                        <p className="text-lg font-serif font-bold tabular-nums">
                          {formatVndFull(
                            selectedRows.reduce((sum, r) => {
                              const s = calculateSellingPriceVnd(parseJpyPrice(r.Price), parseFloat(r.Weight) || 0.3);
                              return sum + (s || 0);
                            }, 0)
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ===== STEP 3: RESULT ===== */}
              {step === 3 && result && (
                <motion.div
                  key="step3"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  className="p-8 space-y-6"
                >
                  {/* Success/Error banner */}
                  <div
                    className={cn(
                      'p-6 rounded-sm border flex items-center gap-6',
                      result.created > 0
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-red-50 border-red-200'
                    )}
                  >
                    <div
                      className={cn(
                        'p-4 rounded-full',
                        result.created > 0 ? 'bg-emerald-100' : 'bg-red-100'
                      )}
                    >
                      {result.created > 0 ? (
                        <CheckCircle2 size={32} className="text-emerald-600" />
                      ) : (
                        <AlertCircle size={32} className="text-brand-red" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-serif font-bold text-brand-ink">
                        {result.created > 0
                          ? t('inventory.csv_import.success_title', 'Import Successful!')
                          : t('inventory.csv_import.failed_title', 'Import Failed')}
                      </h3>
                      <p className="text-sm text-brand-ink/60 mt-1">
                        {t('inventory.csv_import.result_summary', {
                          defaultValue: '{{created}} created, {{skipped}} skipped, {{errors}} errors',
                          created: result.created,
                          skipped: result.skipped,
                          errors: result.errors.length,
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-sm text-center">
                      <p className="text-3xl font-serif font-bold text-emerald-600">{result.created}</p>
                      <p className="text-[10px] uppercase tracking-widest text-emerald-600/60 font-bold mt-1">
                        {t('inventory.csv_import.stat_created', 'Created')}
                      </p>
                    </div>
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-sm text-center">
                      <p className="text-3xl font-serif font-bold text-amber-600">{result.skipped}</p>
                      <p className="text-[10px] uppercase tracking-widest text-amber-600/60 font-bold mt-1">
                        {t('inventory.csv_import.stat_skipped', 'Skipped')}
                      </p>
                    </div>
                    <div className="p-4 bg-red-50 border border-red-200 rounded-sm text-center">
                      <p className="text-3xl font-serif font-bold text-brand-red">{result.errors.length}</p>
                      <p className="text-[10px] uppercase tracking-widest text-brand-red/60 font-bold mt-1">
                        {t('inventory.csv_import.stat_errors', 'Errors')}
                      </p>
                    </div>
                  </div>

                  {/* Error list */}
                  {result.errors.length > 0 && (
                    <div className="border border-red-200 rounded-sm overflow-hidden">
                      <div className="px-4 py-2 bg-red-50 border-b border-red-200">
                        <p className="text-[10px] uppercase tracking-widest text-brand-red font-bold">
                          {t('inventory.csv_import.error_list', 'Error Details')}
                        </p>
                      </div>
                      <div className="max-h-40 overflow-y-auto p-3 space-y-1">
                        {result.errors.map((err, i) => (
                          <p key={i} className="text-xs text-brand-ink/60 font-mono">
                            {err}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ===== FOOTER ===== */}
          <div className="p-6 bg-brand-paper/50 border-t border-brand-clay flex items-center justify-between">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-brand-ink/40 hover:text-brand-red transition-colors"
            >
              {step === 3
                ? t('inventory.csv_import.close', 'Close')
                : t('inventory.csv_import.cancel', 'Cancel')}
            </button>
            <div className="flex items-center gap-4">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 px-6 py-3 border border-brand-clay rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all"
                >
                  <ChevronLeft size={14} />
                  {t('inventory.csv_import.back', 'Back')}
                </button>
              )}
              {step === 2 && (
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={importing || selectedRows.length === 0}
                  className={cn(
                    'flex items-center gap-2 px-12 py-3 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all shadow-xl',
                    importing || selectedRows.length === 0
                      ? 'bg-brand-clay text-brand-ink/40 cursor-not-allowed'
                      : 'bg-brand-red text-white hover:bg-brand-ink hover:shadow-brand-ink/20'
                  )}
                >
                  {importing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {t('inventory.csv_import.importing', 'Importing...')}
                    </>
                  ) : (
                    <>
                      {t('inventory.csv_import.import_button', 'Import Products')}
                      <ChevronRight size={14} />
                    </>
                  )}
                </button>
              )}
              {step === 3 && result && result.created > 0 && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex items-center gap-2 px-12 py-3 bg-brand-ink text-white rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-brand-red transition-all shadow-xl"
                >
                  <CheckCircle2 size={14} />
                  {t('inventory.csv_import.done', 'Done')}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
