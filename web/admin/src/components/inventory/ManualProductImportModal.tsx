import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  FilePenLine,
  ImageOff,
  Loader2,
  PackagePlus,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/api';
import { useFormatPrice } from '../../hooks/useFormatPrice';
import {
  StorefrontCard,
  StorefrontDetail,
  type ImportPreview,
} from './SourceUrlImportModal';

interface Category {
  id: number;
  name: string;
}

interface ManualDraft {
  localId: string;
  source_url: string;
  sku: string;
  name: string;
  description: string;
  source_price_jpy: string;
  category_id: string;
  weight_kg: string;
  stock: string;
  brand: string;
  location: string;
  image_url: string;
  is_new: boolean;
  is_limited: boolean;
  is_featured: boolean;
  is_cheap: boolean;
}

interface PreviewEntry {
  url: string;
  success: boolean;
  preview?: ImportPreview;
  error_code?: string | null;
  message?: string | null;
}

interface BulkResult {
  total: number;
  succeeded: number;
  failed: number;
  items: Array<{
    url: string;
    success: boolean;
    product_id?: string | null;
    error_code?: string | null;
    message?: string | null;
  }>;
}

interface ManualProductImportModalProps {
  isOpen: boolean;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_PRODUCTS = 50;

function createDraft(categoryId = ''): ManualDraft {
  return {
    localId: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    source_url: '',
    sku: '',
    name: '',
    description: '',
    source_price_jpy: '',
    category_id: categoryId,
    weight_kg: '0.30',
    stock: '1',
    brand: '',
    location: 'Japan',
    image_url: '',
    is_new: true,
    is_limited: false,
    is_featured: false,
    is_cheap: false,
  };
}

function apiError(payload: any, fallback: string) {
  return (
    payload?.error?.message
    || payload?.message
    || payload?.detail
    || (typeof payload?.error === 'string' ? payload.error : null)
    || fallback
  );
}

function normalizedUrl(value: string) {
  try {
    return new URL(value.trim()).toString();
  } catch {
    return value.trim();
  }
}

export function ManualProductImportModal({
  isOpen,
  categories,
  onClose,
  onSuccess,
}: ManualProductImportModalProps) {
  const { t } = useTranslation();
  const { format: formatPrice } = useFormatPrice();
  const [drafts, setDrafts] = useState<ManualDraft[]>([]);
  const [activeId, setActiveId] = useState('');
  const [bulkUrlInput, setBulkUrlInput] = useState('');
  const [imageMode, setImageMode] = useState('remote');
  const [previewEntries, setPreviewEntries] = useState<PreviewEntry[]>([]);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initialCategoryId = categories[0] ? String(categories[0].id) : '';

  const reset = () => {
    const first = createDraft(initialCategoryId);
    setDrafts([first]);
    setActiveId(first.localId);
    setBulkUrlInput('');
    setImageMode('remote');
    setPreviewEntries([]);
    setActivePreviewUrl(null);
    setSelectedUrls(new Set());
    setPreviewing(false);
    setImporting(false);
    setResult(null);
    setError(null);
  };

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen]);

  const activeDraft = drafts.find((draft) => draft.localId === activeId) || drafts[0];
  const activePreview = previewEntries.find(
    (entry) => entry.url === activePreviewUrl && entry.success,
  )?.preview;
  const selectableEntries = previewEntries.filter(
    (entry) => entry.success && entry.preview && !entry.preview.duplicate,
  );

  const categoryName = (categoryId: number | null | undefined) => (
    categories.find((category) => category.id === categoryId)?.name || '—'
  );

  const invalidatePreview = () => {
    setPreviewEntries([]);
    setActivePreviewUrl(null);
    setSelectedUrls(new Set());
    setResult(null);
    setError(null);
  };

  const updateDraft = (field: keyof ManualDraft, value: string | boolean) => {
    setDrafts((current) => current.map((draft) => (
      draft.localId === activeDraft?.localId
        ? { ...draft, [field]: value }
        : draft
    )));
    invalidatePreview();
  };

  const addDraft = () => {
    if (drafts.length >= MAX_PRODUCTS) {
      setError(t('inventory.manual_import.limit', { count: MAX_PRODUCTS }));
      return;
    }
    const next = createDraft(activeDraft?.category_id || initialCategoryId);
    setDrafts((current) => [...current, next]);
    setActiveId(next.localId);
    invalidatePreview();
  };

  const addBulkUrls = () => {
    const candidates = bulkUrlInput
      .split(/\s+/)
      .map((url) => url.trim())
      .filter(Boolean);
    if (!candidates.length) return;

    const existing = new Set(
      drafts
        .map((draft) => draft.source_url)
        .filter(Boolean)
        .map(normalizedUrl),
    );
    const uniqueCandidates = candidates.filter((url, index) => (
      !existing.has(normalizedUrl(url))
      && candidates.findIndex((candidate) => (
        normalizedUrl(candidate) === normalizedUrl(url)
      )) === index
    ));
    if (!uniqueCandidates.length) {
      setError(t('inventory.manual_import.no_new_urls'));
      return;
    }

    const available = MAX_PRODUCTS - (
      drafts.length === 1 && !drafts[0].source_url.trim() ? 0 : drafts.length
    );
    const accepted = uniqueCandidates.slice(0, Math.max(0, available));
    let firstAddedId = '';
    const next = [...drafts];
    const remaining = [...accepted];
    if (
      next.length === 1
      && !next[0].source_url.trim()
      && !next[0].name.trim()
      && remaining.length
    ) {
      next[0] = { ...next[0], source_url: remaining.shift() as string };
      firstAddedId = next[0].localId;
    }
    for (const url of remaining) {
      const draft = {
        ...createDraft(activeDraft?.category_id || initialCategoryId),
        source_url: url,
      };
      if (!firstAddedId) firstAddedId = draft.localId;
      next.push(draft);
    }
    setDrafts(next);
    if (firstAddedId) setActiveId(firstAddedId);
    setBulkUrlInput('');
    invalidatePreview();
    if (accepted.length < uniqueCandidates.length) {
      setError(t('inventory.manual_import.limit', { count: MAX_PRODUCTS }));
    }
  };

  const removeDraft = (localId: string) => {
    if (drafts.length === 1) return;
    const next = drafts.filter((draft) => draft.localId !== localId);
    setDrafts(next);
    if (activeId === localId) setActiveId(next[0].localId);
    invalidatePreview();
  };

  const requestItem = (draft: ManualDraft) => ({
    source_url: draft.source_url.trim(),
    sku: draft.sku.trim() || null,
    name: draft.name.trim(),
    description: draft.description.trim(),
    source_price_jpy: draft.source_price_jpy,
    category_id: Number(draft.category_id),
    weight_kg: draft.weight_kg || '0',
    stock: Math.max(0, Number(draft.stock) || 0),
    brand: draft.brand.trim() || null,
    location: draft.location.trim() || 'Japan',
    image_url: draft.image_url.trim() || null,
    is_new: draft.is_new,
    is_limited: draft.is_limited,
    is_featured: draft.is_featured,
    is_cheap: draft.is_cheap,
  });

  const validateDrafts = (items: ManualDraft[]) => {
    const invalid = items.find((draft) => (
      !draft.source_url.trim()
      || !draft.name.trim()
      || draft.source_price_jpy === ''
      || Number(draft.source_price_jpy) < 0
      || !draft.category_id
    ));
    if (invalid) {
      setActiveId(invalid.localId);
      setError(t('inventory.manual_import.required_error'));
      return false;
    }
    const normalizedUrls = items.map((draft) => normalizedUrl(draft.source_url));
    if (new Set(normalizedUrls).size !== normalizedUrls.length) {
      setError(t('inventory.manual_import.duplicate_url'));
      return false;
    }
    return true;
  };

  const previewAll = async () => {
    setError(null);
    if (!validateDrafts(drafts)) return;
    setPreviewing(true);
    try {
      const response = await apiFetch('/products/import-manual/preview/', {
        method: 'POST',
        body: JSON.stringify({
          items: drafts.map(requestItem),
          image_mode: imageMode,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(apiError(
          payload,
          t('inventory.manual_import.preview_failed'),
        ));
      }
      setPreviewEntries(payload.items || []);
      const eligible = (payload.items || [])
        .filter((entry: PreviewEntry) => (
          entry.success && entry.preview && !entry.preview.duplicate
        ))
        .map((entry: PreviewEntry) => entry.url);
      setSelectedUrls(new Set(eligible));
      setActivePreviewUrl(
        (payload.items || []).find((entry: PreviewEntry) => entry.success)?.url || null,
      );
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setPreviewing(false);
    }
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
    const eligible = selectableEntries.map((entry) => entry.url);
    setSelectedUrls(
      selectedUrls.size === eligible.length ? new Set() : new Set(eligible),
    );
  };

  const importSelected = async () => {
    const selectedDrafts = drafts.filter((draft) => (
      selectedUrls.has(normalizedUrl(draft.source_url))
    ));
    if (!selectedDrafts.length) {
      setError(t('inventory.manual_import.select_required'));
      return;
    }
    setError(null);
    setImporting(true);
    try {
      const response = await apiFetch('/products/import-manual/bulk/', {
        method: 'POST',
        body: JSON.stringify({
          items: selectedDrafts.map(requestItem),
          image_mode: imageMode,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(apiError(
          payload,
          t('inventory.manual_import.import_failed'),
        ));
      }
      setResult(payload);
      if (payload.succeeded > 0) onSuccess();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const previewSummary = useMemo(() => ({
    succeeded: previewEntries.filter((entry) => entry.success).length,
    failed: previewEntries.filter((entry) => !entry.success).length,
  }), [previewEntries]);

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
                <FilePenLine size={20} className="text-brand-red" />
              </div>
              <div>
                <h2 className="font-serif text-2xl font-bold">
                  {t('inventory.manual_import.title')}
                </h2>
                <p className="mt-1 text-xs text-brand-ink/50">
                  {t('inventory.manual_import.description')}
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
            {result ? (
              <div className="mx-auto max-w-3xl py-6">
                <div className="text-center">
                  <CheckCircle2
                    size={52}
                    className="mx-auto text-emerald-600"
                  />
                  <h3 className="mt-4 font-serif text-3xl font-bold">
                    {t('inventory.manual_import.result_title')}
                  </h3>
                  <p className="mt-2 text-sm text-brand-ink/55">
                    {t('inventory.manual_import.result_summary', {
                      succeeded: result.succeeded,
                      failed: result.failed,
                    })}
                  </p>
                </div>
                <div className="mt-8 divide-y divide-brand-clay overflow-hidden border border-brand-clay">
                  {result.items.map((item) => (
                    <div key={item.url} className="flex items-start gap-3 p-4">
                      {item.success ? (
                        <CheckCircle2 size={18} className="mt-0.5 text-emerald-600" />
                      ) : (
                        <AlertCircle size={18} className="mt-0.5 text-red-600" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-xs text-brand-ink/45">{item.url}</p>
                        <p className={`mt-1 text-sm font-bold ${
                          item.success ? 'text-emerald-700' : 'text-red-700'
                        }`}>
                          {item.success
                            ? t('inventory.manual_import.created_id', {
                                id: item.product_id,
                              })
                            : item.message || t('inventory.manual_import.import_failed')}
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
                    className="bg-brand-ink px-8 py-3 text-sm font-bold text-white hover:bg-brand-red"
                  >
                    {t('inventory.source_import.done')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <section className="space-y-3 border border-brand-clay bg-brand-paper/20 p-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/60">
                      {t('inventory.manual_import.bulk_urls_label')}
                    </p>
                    <p className="mt-1 text-xs text-brand-ink/40">
                      {t('inventory.manual_import.bulk_urls_help', {
                        count: MAX_PRODUCTS,
                      })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 md:flex-row">
                    <textarea
                      value={bulkUrlInput}
                      onChange={(event) => setBulkUrlInput(event.target.value)}
                      rows={3}
                      placeholder={t('inventory.manual_import.bulk_urls_placeholder')}
                      className="min-h-24 flex-1 resize-y border border-brand-clay bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-brand-red"
                    />
                    <button
                      type="button"
                      onClick={addBulkUrls}
                      disabled={!bulkUrlInput.trim() || drafts.length >= MAX_PRODUCTS}
                      className="flex min-w-44 items-center justify-center gap-2 bg-brand-red px-6 py-3 text-sm font-bold text-white hover:bg-brand-ink disabled:opacity-40"
                    >
                      <Plus size={17} />
                      {t('inventory.manual_import.add_urls')}
                    </button>
                  </div>
                </section>

                <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <aside className="overflow-hidden border border-brand-clay bg-brand-paper/20">
                    <div className="flex items-center justify-between border-b border-brand-clay p-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider">
                          {t('inventory.manual_import.products')}
                        </p>
                        <p className="mt-1 text-[10px] text-brand-ink/40">
                          {drafts.length} / {MAX_PRODUCTS}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addDraft}
                        disabled={drafts.length >= MAX_PRODUCTS}
                        className="rounded-full bg-brand-red p-2 text-white disabled:opacity-40"
                        aria-label={t('inventory.manual_import.add_product')}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className="max-h-[560px] divide-y divide-brand-clay overflow-y-auto">
                      {drafts.map((draft, index) => (
                        <div
                          key={draft.localId}
                          className={`group flex items-center ${
                            activeDraft?.localId === draft.localId
                              ? 'bg-white shadow-sm'
                              : 'hover:bg-white/60'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveId(draft.localId)}
                            className="flex min-w-0 flex-1 items-center gap-3 p-4 text-left"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-clay text-xs font-bold">
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold">
                                {draft.name || t('inventory.manual_import.unnamed')}
                              </span>
                              <span className="mt-0.5 block truncate text-[10px] text-brand-ink/40">
                                {draft.source_url || t('inventory.manual_import.no_url')}
                              </span>
                            </span>
                          </button>
                          {drafts.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeDraft(draft.localId)}
                              className="mr-3 p-2 text-brand-ink/20 hover:text-brand-red"
                              aria-label={t('inventory.source_import.remove_url')}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addDraft}
                      disabled={drafts.length >= MAX_PRODUCTS}
                      className="flex w-full items-center justify-center gap-2 border-t border-brand-clay p-4 text-xs font-bold text-brand-red hover:bg-white disabled:opacity-40"
                    >
                      <PackagePlus size={16} />
                      {t('inventory.manual_import.add_product')}
                    </button>
                  </aside>

                  {activeDraft && (
                    <section className="space-y-5 border border-brand-clay bg-white p-5 md:p-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2 md:col-span-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-brand-ink/50">
                            {t('inventory.manual_import.source_url')} *
                          </span>
                          <input
                            type="url"
                            value={activeDraft.source_url}
                            onChange={(event) => updateDraft('source_url', event.target.value)}
                            placeholder="https://www.amazon.co.jp/dp/... hoặc https://www.qoo10.jp/item/..."
                            className="w-full border border-brand-clay px-3 py-3 text-sm outline-none focus:border-brand-red"
                          />
                          <p className="text-[10px] text-brand-ink/40">
                            {t('inventory.manual_import.source_url_help')}
                          </p>
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-brand-ink/50">
                            {t('inventory.manual_import.sku')}
                          </span>
                          <input
                            value={activeDraft.sku}
                            onChange={(event) => updateDraft('sku', event.target.value)}
                            placeholder="ABC-001"
                            className="w-full border border-brand-clay px-3 py-3 text-sm outline-none focus:border-brand-red"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-brand-ink/50">
                            {t('inventory.source_import.category_label')} *
                          </span>
                          <select
                            value={activeDraft.category_id}
                            onChange={(event) => updateDraft('category_id', event.target.value)}
                            className="w-full border border-brand-clay px-3 py-3 text-sm outline-none focus:border-brand-red"
                          >
                            <option value="">
                              {t('inventory.source_import.category_placeholder')}
                            </option>
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-2 md:col-span-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-brand-ink/50">
                            {t('inventory.manual_import.name')} *
                          </span>
                          <input
                            value={activeDraft.name}
                            onChange={(event) => updateDraft('name', event.target.value)}
                            className="w-full border border-brand-clay px-3 py-3 text-sm outline-none focus:border-brand-red"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-brand-ink/50">
                            {t('inventory.manual_import.source_price')} *
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={activeDraft.source_price_jpy}
                            onChange={(event) => updateDraft('source_price_jpy', event.target.value)}
                            className="w-full border border-brand-clay px-3 py-3 text-sm outline-none focus:border-brand-red"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-brand-ink/50">
                            {t('inventory.manual_import.image_url')}
                          </span>
                          <input
                            type="url"
                            value={activeDraft.image_url}
                            onChange={(event) => updateDraft('image_url', event.target.value)}
                            placeholder="https://..."
                            className="w-full border border-brand-clay px-3 py-3 text-sm outline-none focus:border-brand-red"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-brand-ink/50">
                            {t('inventory.source_import.weight_label')}
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={activeDraft.weight_kg}
                            onChange={(event) => updateDraft('weight_kg', event.target.value)}
                            className="w-full border border-brand-clay px-3 py-3 text-sm outline-none focus:border-brand-red"
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
                            value={activeDraft.stock}
                            onChange={(event) => updateDraft('stock', event.target.value)}
                            className="w-full border border-brand-clay px-3 py-3 text-sm outline-none focus:border-brand-red"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-brand-ink/50">
                            {t('inventory.manual_import.brand')}
                          </span>
                          <input
                            value={activeDraft.brand}
                            onChange={(event) => updateDraft('brand', event.target.value)}
                            className="w-full border border-brand-clay px-3 py-3 text-sm outline-none focus:border-brand-red"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-brand-ink/50">
                            {t('inventory.manual_import.location')}
                          </span>
                          <input
                            value={activeDraft.location}
                            onChange={(event) => updateDraft('location', event.target.value)}
                            className="w-full border border-brand-clay px-3 py-3 text-sm outline-none focus:border-brand-red"
                          />
                        </label>
                        <label className="space-y-2 md:col-span-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-brand-ink/50">
                            {t('inventory.manual_import.product_description')}
                          </span>
                          <textarea
                            rows={4}
                            value={activeDraft.description}
                            onChange={(event) => updateDraft('description', event.target.value)}
                            className="w-full resize-y border border-brand-clay px-3 py-3 text-sm outline-none focus:border-brand-red"
                          />
                        </label>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-4">
                        {[
                          ['is_new', t('inventory.manual_import.is_new')],
                          ['is_featured', t('inventory.manual_import.is_featured')],
                          ['is_limited', t('inventory.manual_import.is_limited')],
                          ['is_cheap', t('inventory.manual_import.is_cheap')],
                        ].map(([field, label]) => (
                          <label
                            key={field}
                            className="flex cursor-pointer items-center gap-2 border border-brand-clay p-3 text-xs font-bold"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(activeDraft[field as keyof ManualDraft])}
                              onChange={(event) => updateDraft(
                                field as keyof ManualDraft,
                                event.target.checked,
                              )}
                              className="accent-brand-red"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </section>
                  )}
                </div>

                <section className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-ink/50">
                    {t('inventory.source_import.image_mode_label')}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { value: 'download', Icon: Download, key: 'image_download' },
                      { value: 'remote', Icon: ExternalLink, key: 'image_remote' },
                      { value: 'skip', Icon: ImageOff, key: 'image_skip' },
                    ].map(({ value, Icon, key }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setImageMode(value);
                          invalidatePreview();
                        }}
                        className={`flex items-center gap-3 border p-3 text-left text-xs font-bold ${
                          imageMode === value
                            ? 'border-brand-red bg-brand-red/5 text-brand-red'
                            : 'border-brand-clay text-brand-ink/60'
                        }`}
                      >
                        <Icon size={16} />
                        {t(`inventory.source_import.${key}`)}
                      </button>
                    ))}
                  </div>
                </section>

                {error && (
                  <div className="flex items-start gap-3 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={previewAll}
                  disabled={previewing || drafts.length === 0}
                  className="flex w-full items-center justify-center gap-3 bg-brand-red px-6 py-4 text-sm font-bold text-white hover:bg-brand-ink disabled:opacity-50"
                >
                  {previewing ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Search size={18} />
                  )}
                  {previewing
                    ? t('inventory.manual_import.previewing')
                    : t('inventory.manual_import.preview_button', {
                        count: drafts.length,
                      })}
                </button>

                {previewEntries.length > 0 && (
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
                          {t('inventory.manual_import.preview_summary', previewSummary)}
                        </p>
                      </div>
                      {selectableEntries.length > 0 && (
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold">
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
                        entry.success && entry.preview ? (
                          <StorefrontCard
                            key={entry.url}
                            preview={entry.preview}
                            categoryName={categoryName(entry.preview.product_payload.category)}
                            selected={selectedUrls.has(entry.url)}
                            active={activePreviewUrl === entry.url}
                            onSelect={() => toggleSelected(entry.url)}
                            onOpenDetail={() => setActivePreviewUrl(entry.url)}
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
                              {entry.message || t('inventory.manual_import.preview_failed')}
                            </p>
                          </div>
                        )
                      ))}
                    </div>

                    {activePreview && (
                      <StorefrontDetail
                        preview={activePreview}
                        categoryName={categoryName(activePreview.product_payload.category)}
                        formatPrice={formatPrice}
                        t={t}
                      />
                    )}
                  </section>
                )}
              </>
            )}
          </div>

          {!result && (
            <div className="flex flex-col-reverse gap-3 border-t border-brand-clay bg-brand-paper/30 p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-brand-ink/45">
                {previewEntries.length
                  ? t('inventory.source_import.selected_count', {
                      count: selectedUrls.size,
                    })
                  : t('inventory.manual_import.preview_first')}
              </p>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 text-sm font-bold text-brand-ink/60 hover:text-brand-red"
                >
                  {t('inventory.source_import.cancel')}
                </button>
                <button
                  type="button"
                  onClick={importSelected}
                  disabled={!selectedUrls.size || importing || previewing}
                  className="flex items-center justify-center gap-2 bg-brand-ink px-7 py-3 text-sm font-bold text-white hover:bg-brand-red disabled:opacity-40"
                >
                  {importing && <Loader2 size={17} className="animate-spin" />}
                  {importing
                    ? t('inventory.source_import.importing')
                    : t('inventory.manual_import.import_selected', {
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
