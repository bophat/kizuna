import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  Heart,
  ImageOff,
  Link2,
  Loader2,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { apiFetch } from '../../lib/api';
import { useFormatPrice } from '../../hooks/useFormatPrice';

interface Category {
  id: number;
  name: string;
}

export interface ImportPreview {
  provider: string;
  source_product_id: string;
  canonical_url: string;
  duplicate: boolean;
  category_required: boolean;
  product_payload: {
    id: string;
    name: string;
    price: string;
    category: number | null;
    stock: number;
    description: string;
    brand: string | null;
    location: string | null;
    weight: string | null;
    status: string;
    is_new: boolean;
  };
  source: {
    source_price: string | null;
    source_currency: 'JPY' | 'USD' | 'VND';
    source_price_jpy: string | null;
    availability: string;
    images: string[];
  };
  pricing: {
    source_price_vnd: string;
    import_cost_vnd: string;
    shipping_vnd: string;
    selling_price_vnd: string;
    selling_price_usd: string;
  } | null;
  warnings: string[];
}

interface PreviewEntry {
  url: string;
  status: 'loading' | 'success' | 'error';
  preview?: ImportPreview;
  error?: string;
}

interface BulkImportItem {
  url: string;
  success: boolean;
  product_id?: string | null;
  error_code?: string | null;
  message?: string | null;
}

interface BulkImportResult {
  total: number;
  succeeded: number;
  failed: number;
  items: BulkImportItem[];
}

interface SourceUrlImportModalProps {
  isOpen: boolean;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_URLS = 50;
const PREVIEW_CONCURRENCY = 3;

function responseError(payload: any, fallback: string) {
  return (
    payload?.error?.message ||
    payload?.message ||
    payload?.detail ||
    (typeof payload?.error === 'string' ? payload.error : null) ||
    fallback
  );
}

function parseUrlInput(value: string) {
  return value
    .split(/\s+/)
    .map((url) => url.trim())
    .filter(Boolean);
}

export function StorefrontCard({
  preview,
  categoryName,
  selected,
  active,
  onSelect,
  onOpenDetail,
  formatPrice,
  t,
}: {
  key?: string;
  preview: ImportPreview;
  categoryName: string;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
  onOpenDetail: () => void;
  formatPrice: (value: string | number) => string;
  t: TFunction;
}) {
  const image = preview.source.images[0];
  const disabled = preview.duplicate || !preview.pricing;

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-sm border bg-white transition-all duration-300 ${
        active
          ? 'border-brand-red shadow-lg ring-2 ring-brand-red/10'
          : 'border-[#e5e2e1] hover:-translate-y-0.5 hover:shadow-lg'
      } ${disabled ? 'opacity-70' : ''}`}
    >
      <div className="relative aspect-square overflow-hidden bg-[#f0eded]">
        {image ? (
          <img
            src={image}
            alt={preview.product_payload.name}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package size={40} className="text-brand-ink/20" />
          </div>
        )}

        <div className="absolute left-4 top-4 flex flex-col gap-2">
          {preview.product_payload.is_new && (
            <span className="w-fit rounded-sm bg-blue-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              {t('inventory.source_import.new_badge')}
            </span>
          )}
          {preview.duplicate && (
            <span className="w-fit rounded-sm bg-amber-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              {t('inventory.source_import.duplicate_badge')}
            </span>
          )}
        </div>

        <label className="absolute right-3 top-3 flex cursor-pointer items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-xs font-bold shadow-md backdrop-blur">
          <input
            type="checkbox"
            checked={selected}
            disabled={disabled}
            onChange={onSelect}
            className="accent-brand-red"
          />
          {t('inventory.source_import.select')}
        </label>

        <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <button
            type="button"
            onClick={onOpenDetail}
            className="scale-95 rounded-full bg-white p-4 text-brand-ink shadow-lg transition-transform group-hover:scale-100 hover:bg-brand-red hover:text-white"
            aria-label={t('inventory.source_import.view_detail')}
          >
            <Eye size={20} />
          </button>
          <span className="scale-95 rounded-full bg-brand-red p-4 text-white shadow-lg transition-transform group-hover:scale-100">
            <ShoppingBag size={20} />
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenDetail}
        className="flex flex-1 flex-col gap-2 p-6 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#5d5f5f]">
              {categoryName}
            </p>
            <h3 className="mt-1 line-clamp-2 text-lg font-medium leading-[1.6] transition-colors group-hover:text-brand-red">
              {preview.product_payload.name}
            </h3>
          </div>
          <Heart size={16} className="mt-1 shrink-0 text-[#5d5f5f]" />
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <p className="text-sm font-bold">
            {formatPrice(preview.product_payload.price)}
          </p>
          <p className="text-[10px] text-brand-ink/40">
            {preview.product_payload.brand || '—'}
          </p>
        </div>
      </button>
    </article>
  );
}

export function StorefrontDetail({
  preview,
  categoryName,
  formatPrice,
  t,
}: {
  preview: ImportPreview;
  categoryName: string;
  formatPrice: (value: string | number) => string;
  t: TFunction;
}) {
  const image = preview.source.images[0];

  return (
    <section className="overflow-hidden rounded-lg border border-[#e5e2e1] bg-[#fcf9f8]">
      <div className="border-b border-[#e5e2e1] bg-white px-6 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-red">
          {t('inventory.source_import.detail_preview')}
        </p>
        <p className="mt-1 text-xs text-brand-ink/45">
          {t('inventory.source_import.detail_preview_help')}
        </p>
      </div>
      <div className="grid gap-8 p-6 lg:grid-cols-2 lg:p-8">
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-[#e5e2e1] bg-[#f0eded]">
          {image ? (
            <img
              src={image}
              alt={preview.product_payload.name}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package size={56} className="text-brand-ink/20" />
            </div>
          )}
          {preview.product_payload.is_new && (
            <span className="absolute left-4 top-4 rounded-sm bg-blue-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              {t('inventory.source_import.new_badge')}
            </span>
          )}
        </div>

        <div className="flex flex-col">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#5d5f5f]">
            {preview.product_payload.brand || categoryName}
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold leading-[1.3]">
            {preview.product_payload.name}
          </h2>
          <p className="mt-4 text-3xl font-medium">
            {formatPrice(preview.product_payload.price)}
          </p>
          <p className="mt-7 whitespace-pre-line text-base leading-[1.7] text-[#5d5f5f]">
            {preview.product_payload.description}
          </p>

          <div className="mt-8">
            <p className="mb-3 text-sm font-medium">
              {t('inventory.source_import.quantity')}
            </p>
            <div className="flex w-32 items-center rounded-full bg-[#e5e2e1] p-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-full">−</span>
              <span className="flex-1 text-center font-medium">1</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full">+</span>
            </div>
            <p className="mt-2 text-xs text-[#5d5f5f]">
              {t('inventory.source_import.items_available', {
                count: preview.product_payload.stock,
              })}
            </p>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-brand-red font-bold text-white shadow-lg shadow-brand-red/20">
              <ShoppingBag size={20} />
              <span>
                {t('inventory.source_import.add_to_cart')} –{' '}
                {formatPrice(preview.product_payload.price)}
              </span>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#e5e2e1] bg-white">
              <Heart size={24} />
            </div>
          </div>

          <div className="mt-6 space-y-3 border-t border-[#e5e2e1] pt-6 text-sm text-[#5d5f5f]">
            <p className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {t('inventory.source_import.ships_from', {
                location: preview.product_payload.location || 'Japan',
              })}
            </p>
            <a
              href={preview.canonical_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-bold text-brand-red hover:underline"
            >
              {t('inventory.source_import.open_source')} <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SourceUrlImportModal({
  isOpen,
  categories,
  onClose,
  onSuccess,
}: SourceUrlImportModalProps) {
  const { t } = useTranslation();
  const { format: formatPrice } = useFormatPrice();
  const [urlInput, setUrlInput] = useState('');
  const [urls, setUrls] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [weight, setWeight] = useState('0.30');
  const [stock, setStock] = useState('1');
  const [imageMode, setImageMode] = useState('download');
  const [previewEntries, setPreviewEntries] = useState<PreviewEntry[]>([]);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setUrlInput('');
    setUrls([]);
    setCategoryId('');
    setWeight('0.30');
    setStock('1');
    setImageMode('download');
    setPreviewEntries([]);
    setPreviewProgress(0);
    setPreviewing(false);
    setSelectedUrls(new Set());
    setActiveUrl(null);
    setImporting(false);
    setImportResult(null);
    setError(null);
  };

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen]);

  const categoryName = useMemo(
    () => (
      categories.find((category) => String(category.id) === categoryId)?.name
      || t('inventory.source_import.uncategorized')
    ),
    [categories, categoryId, t],
  );

  const activePreview = useMemo(
    () => previewEntries.find(
      (entry) => entry.url === activeUrl && entry.status === 'success',
    )?.preview,
    [activeUrl, previewEntries],
  );

  const successfulEntries = previewEntries.filter(
    (entry) => entry.status === 'success' && entry.preview,
  );
  const selectableEntries = successfulEntries.filter(
    (entry) => !entry.preview?.duplicate && entry.preview?.pricing,
  );

  const invalidatePreview = () => {
    setPreviewEntries([]);
    setSelectedUrls(new Set());
    setActiveUrl(null);
    setImportResult(null);
    setError(null);
  };

  const handleAddUrls = () => {
    const candidates = parseUrlInput(urlInput);
    if (candidates.length === 0) {
      setError(t('inventory.source_import.url_required'));
      return;
    }

    const next = [...urls];
    for (const candidate of candidates) {
      if (!next.includes(candidate) && next.length < MAX_URLS) {
        next.push(candidate);
      }
    }
    setUrls(next);
    setUrlInput('');
    invalidatePreview();
    if (next.length >= MAX_URLS && candidates.some((candidate) => !next.includes(candidate))) {
      setError(t('inventory.source_import.url_limit', { count: MAX_URLS }));
    }
  };

  const handleRemoveUrl = (url: string) => {
    setUrls((current) => current.filter((value) => value !== url));
    invalidatePreview();
  };

  const requestPayload = (url: string) => ({
    url,
    category_id: categoryId ? Number(categoryId) : null,
    default_weight_kg: weight === '' ? null : weight,
    default_stock: Math.max(0, Number(stock) || 0),
    image_mode: imageMode,
  });

  const fetchPreview = async (url: string): Promise<PreviewEntry> => {
    try {
      const response = await apiFetch('/products/import-source/preview/', {
        method: 'POST',
        body: JSON.stringify(requestPayload(url)),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(responseError(payload, t('inventory.source_import.preview_failed')));
      }
      return { url, status: 'success', preview: payload };
    } catch (requestError) {
      return {
        url,
        status: 'error',
        error: (requestError as Error).message,
      };
    }
  };

  const handlePreviewAll = async () => {
    setError(null);
    setImportResult(null);
    if (urls.length === 0) {
      setError(t('inventory.source_import.url_required'));
      return;
    }
    const slots: PreviewEntry[] = urls.map((url) => ({ url, status: 'loading' }));
    setPreviewEntries(slots);
    setPreviewProgress(0);
    setPreviewing(true);
    setSelectedUrls(new Set());
    setActiveUrl(null);

    let cursor = 0;
    let completed = 0;
    const worker = async () => {
      while (cursor < urls.length) {
        const index = cursor;
        cursor += 1;
        slots[index] = await fetchPreview(urls[index]);
        completed += 1;
        setPreviewEntries([...slots]);
        setPreviewProgress(completed);
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(PREVIEW_CONCURRENCY, urls.length) },
        () => worker(),
      ),
    );

    const eligibleUrls = slots
      .filter(
        (entry) => (
          entry.status === 'success'
          && entry.preview
          && !entry.preview.duplicate
          && entry.preview.pricing
        ),
      )
      .map((entry) => entry.url);
    const firstSuccess = slots.find(
      (entry) => entry.status === 'success' && entry.preview,
    );
    setSelectedUrls(new Set(eligibleUrls));
    setActiveUrl(firstSuccess?.url || null);
    setPreviewing(false);
  };

  const toggleSelected = (url: string) => {
    setSelectedUrls((current) => {
      const next = new Set(current);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const toggleAll = () => {
    const eligibleUrls = selectableEntries.map((entry) => entry.url);
    setSelectedUrls(
      selectedUrls.size === eligibleUrls.length
        ? new Set()
        : new Set(eligibleUrls),
    );
  };

  const handleImport = async () => {
    const importUrls = urls.filter((url) => selectedUrls.has(url));
    if (importUrls.length === 0) {
      setError(t('inventory.source_import.select_required'));
      return;
    }
    setError(null);
    setImporting(true);
    try {
      const response = await apiFetch('/products/import-source/bulk/', {
        method: 'POST',
        body: JSON.stringify({
          urls: importUrls,
          category_id: categoryId ? Number(categoryId) : null,
          default_weight_kg: weight === '' ? null : weight,
          default_stock: Math.max(0, Number(stock) || 0),
          image_mode: imageMode,
          dry_run: false,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(responseError(payload, t('inventory.source_import.import_failed')));
      }
      setImportResult(payload);
      if (payload.succeeded > 0) onSuccess();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-brand-ink/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 16 }}
          className="relative flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-brand-clay bg-brand-paper/50 p-5 md:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-sm bg-brand-red/10 p-2">
                <Link2 size={20} className="text-brand-red" />
              </div>
              <div>
                <h2 className="font-serif text-2xl font-bold">
                  {t('inventory.source_import.title')}
                </h2>
                <p className="mt-1 text-xs text-brand-ink/50">
                  {t('inventory.source_import.description_multi')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-brand-ink/40 transition-colors hover:text-brand-red"
              aria-label={t('inventory.source_import.close')}
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto p-5 md:p-8">
            {importResult ? (
              <div className="mx-auto max-w-3xl py-6">
                <div className="text-center">
                  <div className={`mx-auto mb-5 w-fit rounded-full p-5 ${
                    importResult.succeeded > 0
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-red-50 text-red-600'
                  }`}>
                    {importResult.succeeded > 0
                      ? <CheckCircle2 size={42} />
                      : <AlertCircle size={42} />}
                  </div>
                  <h3 className="font-serif text-3xl font-bold">
                    {t('inventory.source_import.import_result_title')}
                  </h3>
                  <p className="mt-2 text-sm text-brand-ink/55">
                    {t('inventory.source_import.import_result_summary', {
                      succeeded: importResult.succeeded,
                      failed: importResult.failed,
                    })}
                  </p>
                </div>

                <div className="mt-8 divide-y divide-brand-clay overflow-hidden border border-brand-clay">
                  {importResult.items.map((item) => (
                    <div key={item.url} className="flex items-start gap-3 bg-white p-4">
                      {item.success ? (
                        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                      ) : (
                        <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-brand-ink/45">{item.url}</p>
                        <p className={`mt-1 text-sm font-bold ${
                          item.success ? 'text-emerald-700' : 'text-red-700'
                        }`}>
                          {item.success
                            ? t('inventory.source_import.imported_id', {
                                id: item.product_id,
                              })
                            : item.message || t('inventory.source_import.import_failed')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-5 text-center text-xs text-brand-ink/45">
                  {t('inventory.source_import.draft_notice')}
                </p>
                <div className="mt-7 flex justify-center">
                  <button
                    type="button"
                    onClick={onClose}
                    className="bg-brand-ink px-8 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-red"
                  >
                    {t('inventory.source_import.done')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <section className="space-y-4 rounded-lg border border-brand-clay bg-brand-paper/20 p-5">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/60">
                      {t('inventory.source_import.urls_label')}
                    </label>
                    <p className="mt-1 text-xs text-brand-ink/40">
                      {t('inventory.source_import.urls_help', {
                        count: MAX_URLS,
                      })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
                    <textarea
                      value={urlInput}
                      onChange={(event) => setUrlInput(event.target.value)}
                      placeholder={t('inventory.source_import.urls_placeholder')}
                      rows={3}
                      className="min-h-24 flex-1 resize-y border border-brand-clay bg-white px-4 py-3 text-sm leading-6 outline-none transition-all focus:border-brand-red focus:ring-4 focus:ring-brand-red/5"
                    />
                    <button
                      type="button"
                      onClick={handleAddUrls}
                      disabled={!urlInput.trim() || urls.length >= MAX_URLS}
                      className="flex min-w-40 items-center justify-center gap-2 bg-brand-red px-6 py-3 text-sm font-bold text-white transition-all hover:bg-brand-ink disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus size={17} />
                      {t('inventory.source_import.add_urls')}
                    </button>
                  </div>

                  {urls.length > 0 && (
                    <div className="overflow-hidden border border-brand-clay bg-white">
                      <div className="flex items-center justify-between border-b border-brand-clay bg-brand-paper/40 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-brand-ink/55">
                          {t('inventory.source_import.added_count', {
                            count: urls.length,
                            max: MAX_URLS,
                          })}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setUrls([]);
                            invalidatePreview();
                          }}
                          className="text-xs font-bold text-brand-red hover:underline"
                        >
                          {t('inventory.source_import.clear_all')}
                        </button>
                      </div>
                      <div className="max-h-44 divide-y divide-brand-clay/70 overflow-y-auto">
                        {urls.map((url, index) => (
                          <div key={url} className="flex items-center gap-3 px-4 py-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-clay text-[10px] font-bold">
                              {index + 1}
                            </span>
                            <p className="min-w-0 flex-1 truncate text-xs text-brand-ink/60">
                              {url}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleRemoveUrl(url)}
                              className="text-brand-ink/25 transition-colors hover:text-brand-red"
                              aria-label={t('inventory.source_import.remove_url')}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-ink/50">
                      {t('inventory.source_import.category_label')}
                    </span>
                    <select
                      value={categoryId}
                      disabled={categories.length === 0}
                      onChange={(event) => {
                        setCategoryId(event.target.value);
                        invalidatePreview();
                      }}
                      className="w-full border border-brand-clay bg-white px-3 py-3 text-sm outline-none focus:border-brand-red disabled:cursor-not-allowed disabled:bg-brand-paper/50 disabled:text-brand-ink/50"
                    >
                      <option value="">{t('inventory.source_import.category_placeholder')}</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <span className="block text-[11px] leading-relaxed text-brand-ink/45">
                      {t('inventory.source_import.category_help')}
                    </span>
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-ink/50">
                      {t('inventory.source_import.weight_label')}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={weight}
                      onChange={(event) => {
                        setWeight(event.target.value);
                        invalidatePreview();
                      }}
                      className="w-full border border-brand-clay bg-white px-3 py-3 text-sm outline-none focus:border-brand-red"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-ink/50">
                      {t('inventory.source_import.stock_label')}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={stock}
                      onChange={(event) => {
                        setStock(event.target.value);
                        invalidatePreview();
                      }}
                      className="w-full border border-brand-clay bg-white px-3 py-3 text-sm outline-none focus:border-brand-red"
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-ink/50">
                    {t('inventory.source_import.image_mode_label')}
                  </span>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { value: 'download', Icon: Download, label: 'image_download' },
                      { value: 'remote', Icon: ExternalLink, label: 'image_remote' },
                      { value: 'skip', Icon: ImageOff, label: 'image_skip' },
                    ].map(({ value, Icon, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setImageMode(value);
                          invalidatePreview();
                        }}
                        className={`flex items-center gap-3 border p-3 text-left text-xs transition-all ${
                          imageMode === value
                            ? 'border-brand-red bg-brand-red/5 text-brand-red'
                            : 'border-brand-clay text-brand-ink/60 hover:border-brand-ink/30'
                        }`}
                      >
                        <Icon size={16} />
                        <span className="font-bold">
                          {t(`inventory.source_import.${label}`)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-3 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handlePreviewAll}
                  disabled={previewing || urls.length === 0}
                  className="flex w-full items-center justify-center gap-3 border border-brand-red bg-brand-red px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-brand-ink disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {previewing ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Search size={18} />
                  )}
                  {previewing
                    ? t('inventory.source_import.preview_progress', {
                        completed: previewProgress,
                        total: urls.length,
                      })
                    : t('inventory.source_import.preview_all', {
                        count: urls.length,
                      })}
                </button>

                {previewEntries.length > 0 && !previewing && (
                  <section className="space-y-5 border-t border-brand-clay pt-7">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-red">
                          {t('inventory.source_import.website_preview')}
                        </p>
                        <h3 className="mt-1 font-serif text-3xl font-bold">
                          {t('inventory.source_import.collection_preview')}
                        </h3>
                        <p className="mt-1 text-xs text-brand-ink/45">
                          {t('inventory.source_import.preview_match_notice')}
                        </p>
                      </div>
                      {selectableEntries.length > 0 && (
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-brand-ink/60">
                          <input
                            type="checkbox"
                            checked={
                              selectedUrls.size > 0
                              && selectedUrls.size === selectableEntries.length
                            }
                            onChange={toggleAll}
                            className="accent-brand-red"
                          />
                          {t('inventory.source_import.select_all', {
                            selected: selectedUrls.size,
                            total: selectableEntries.length,
                          })}
                        </label>
                      )}
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {previewEntries.map((entry) => (
                        entry.status === 'success' && entry.preview ? (
                          <StorefrontCard
                            key={entry.url}
                            preview={entry.preview}
                            categoryName={categoryName}
                            selected={selectedUrls.has(entry.url)}
                            active={activeUrl === entry.url}
                            onSelect={() => toggleSelected(entry.url)}
                            onOpenDetail={() => setActiveUrl(entry.url)}
                            formatPrice={formatPrice}
                            t={t}
                          />
                        ) : (
                          <div
                            key={entry.url}
                            className="flex min-h-72 flex-col items-center justify-center border border-red-200 bg-red-50 p-5 text-center"
                          >
                            <AlertCircle size={28} className="text-red-500" />
                            <p className="mt-3 line-clamp-2 text-xs text-brand-ink/45">
                              {entry.url}
                            </p>
                            <p className="mt-2 text-sm font-bold text-red-700">
                              {entry.error || t('inventory.source_import.preview_failed')}
                            </p>
                          </div>
                        )
                      ))}
                    </div>

                    {activePreview && (
                      <StorefrontDetail
                        preview={activePreview}
                        categoryName={categoryName}
                        formatPrice={formatPrice}
                        t={t}
                      />
                    )}
                  </section>
                )}
              </>
            )}
          </div>

          {!importResult && (
            <div className="flex flex-col-reverse gap-3 border-t border-brand-clay bg-brand-paper/30 p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-brand-ink/45">
                {previewEntries.length > 0
                  ? t('inventory.source_import.selected_count', {
                      count: selectedUrls.size,
                    })
                  : t('inventory.source_import.preview_before_import')}
              </p>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 text-sm font-bold text-brand-ink/60 transition-colors hover:text-brand-red"
                >
                  {t('inventory.source_import.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={selectedUrls.size === 0 || importing || previewing}
                  className="flex items-center justify-center gap-2 bg-brand-ink px-7 py-3 text-sm font-bold text-white transition-all hover:bg-brand-red disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {importing && <Loader2 size={17} className="animate-spin" />}
                  {importing
                    ? t('inventory.source_import.importing')
                    : t('inventory.source_import.import_selected', {
                        count: selectedUrls.size,
                      })}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
