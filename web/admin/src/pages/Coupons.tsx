import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  Edit3,
  Loader2,
  Plus,
  Search,
  TicketPercent,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

import { apiFetch } from '../lib/api';
import { formatApiErrors } from '../lib/formatApiErrors';

type Coupon = {
  id: number;
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: string;
  minimum_order_amount: string;
  maximum_discount_amount: string | null;
  usage_limit: number | null;
  per_user_limit: number;
  used_count: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

type CouponForm = {
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: string;
  minimum_order_amount: string;
  maximum_discount_amount: string;
  usage_limit: string;
  per_user_limit: string;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
};

const emptyForm: CouponForm = {
  code: '',
  description: '',
  discount_type: 'percentage',
  discount_value: '10',
  minimum_order_amount: '0',
  maximum_discount_amount: '',
  usage_limit: '',
  per_user_limit: '1',
  starts_at: '',
  expires_at: '',
  is_active: true,
};

function toLocalInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export default function Coupons() {
  const { t, i18n } = useTranslation();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm);

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/coupons/');
      if (!response.ok) throw new Error();
      setCoupons(await response.json());
      setError('');
    } catch {
      setError(t('coupons.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return coupons;
    return coupons.filter((coupon) =>
      `${coupon.code} ${coupon.description}`.toLowerCase().includes(query),
    );
  }, [coupons, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (coupon: Coupon) => {
    setEditing(coupon);
    setForm({
      code: coupon.code,
      description: coupon.description || '',
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      minimum_order_amount: coupon.minimum_order_amount,
      maximum_discount_amount: coupon.maximum_discount_amount || '',
      usage_limit: coupon.usage_limit?.toString() || '',
      per_user_limit: coupon.per_user_limit.toString(),
      starts_at: toLocalInput(coupon.starts_at),
      expires_at: toLocalInput(coupon.expires_at),
      is_active: coupon.is_active,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };

  const updateField = <K extends keyof CouponForm>(key: K, value: CouponForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      const payload = {
        ...form,
        code: form.code.trim().toUpperCase(),
        maximum_discount_amount: form.maximum_discount_amount || null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        per_user_limit: Number(form.per_user_limit),
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      };
      const response = await apiFetch(
        editing ? `/coupons/${editing.id}/` : '/coupons/',
        {
          method: editing ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(formatApiErrors(data));
      }
      setModalOpen(false);
      setNotice(t(editing ? 'coupons.updated' : 'coupons.created'));
      await loadCoupons();
    } catch (submitError) {
      setError(
        submitError instanceof Error && submitError.message
          ? submitError.message
          : t('coupons.errors.save'),
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleCoupon = async (coupon: Coupon) => {
    const response = await apiFetch(`/coupons/${coupon.id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !coupon.is_active }),
    });
    if (response.ok) {
      setNotice(t(coupon.is_active ? 'coupons.disabled' : 'coupons.enabled'));
      await loadCoupons();
    } else {
      setError(t('coupons.errors.save'));
    }
  };

  const deleteCoupon = async (coupon: Coupon) => {
    if (!window.confirm(t('coupons.confirm_delete', { code: coupon.code }))) return;
    const response = await apiFetch(`/coupons/${coupon.id}/`, { method: 'DELETE' });
    if (response.ok) {
      setNotice(t('coupons.deleted'));
      await loadCoupons();
      return;
    }
    const data = await response.json().catch(() => ({}));
    setError(formatApiErrors(data) || t('coupons.errors.delete'));
  };

  const statusFor = (coupon: Coupon) => {
    const now = Date.now();
    if (!coupon.is_active) return 'inactive';
    if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) return 'scheduled';
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= now) return 'expired';
    if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) return 'exhausted';
    return 'active';
  };

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="ma-spacing space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-brand-red">
            {t('coupons.subtitle')}
          </p>
          <h1 className="flex items-center gap-3 text-4xl font-bold font-serif text-brand-ink">
            <TicketPercent size={34} className="text-brand-red" />
            {t('coupons.title')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-brand-ink/60">{t('coupons.description')}</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-md bg-brand-ink px-6 py-3 text-sm font-medium text-white shadow-lg transition-all hover:bg-brand-red"
        >
          <Plus size={18} /> {t('coupons.add')}
        </button>
      </div>

      {(error || notice) && (
        <div className={`flex items-center justify-between rounded-md border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          <span className="flex items-center gap-2"><AlertCircle size={17} />{error || notice}</span>
          <button onClick={() => { setError(''); setNotice(''); }}><X size={16} /></button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-brand-clay bg-white shadow-sm">
        <div className="border-b border-brand-clay bg-brand-paper/30 p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/30" size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('coupons.search')}
              className="w-full rounded-md border border-brand-clay bg-white py-2 pl-10 pr-4 text-sm outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/10"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-brand-ink/50">
            <Loader2 className="animate-spin text-brand-red" /> {t('common.loading')}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-brand-ink/40">
            <TicketPercent size={42} />
            <p className="font-serif text-lg italic">{t('coupons.empty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-brand-paper text-[10px] uppercase tracking-wider text-brand-ink/50">
                <tr>
                  <th className="px-6 py-4">{t('coupons.table.code')}</th>
                  <th className="px-6 py-4">{t('coupons.table.discount')}</th>
                  <th className="px-6 py-4">{t('coupons.table.period')}</th>
                  <th className="px-6 py-4">{t('coupons.table.usage')}</th>
                  <th className="px-6 py-4">{t('coupons.table.status')}</th>
                  <th className="px-6 py-4 text-right">{t('coupons.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-clay">
                {filtered.map((coupon) => {
                  const couponStatus = statusFor(coupon);
                  return (
                    <tr key={coupon.id} className="transition hover:bg-brand-paper/40">
                      <td className="px-6 py-4">
                        <code className="rounded bg-brand-red/10 px-2.5 py-1 font-bold text-brand-red">{coupon.code}</code>
                        {coupon.description && <p className="mt-2 max-w-xs truncate text-xs text-brand-ink/50">{coupon.description}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold">
                        {coupon.discount_type === 'percentage'
                          ? `${Number(coupon.discount_value)}%`
                          : `$${Number(coupon.discount_value).toFixed(2)}`}
                        {coupon.minimum_order_amount !== '0.00' && (
                          <p className="mt-1 text-xs font-normal text-brand-ink/45">
                            {t('coupons.minimum_short', { amount: `$${Number(coupon.minimum_order_amount).toFixed(2)}` })}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-brand-ink/60">
                        <div className="flex items-start gap-2"><CalendarClock size={15} className="mt-0.5 shrink-0" />
                          <span>
                            {coupon.starts_at ? dateFormatter.format(new Date(coupon.starts_at)) : t('coupons.now')}<br />
                            {coupon.expires_at ? dateFormatter.format(new Date(coupon.expires_at)) : t('coupons.no_expiry')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="font-semibold">{coupon.used_count}</span> / {coupon.usage_limit ?? '∞'}
                        <p className="mt-1 text-xs text-brand-ink/45">{t('coupons.per_customer', { count: coupon.per_user_limit })}</p>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleCoupon(coupon)}
                          className={`rounded-full px-3 py-1 text-xs font-bold ${couponStatus === 'active' ? 'bg-emerald-100 text-emerald-700' : couponStatus === 'scheduled' ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-600'}`}
                        >
                          {t(`coupons.status.${couponStatus}`)}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => openEdit(coupon)} className="rounded-md p-2 transition hover:bg-brand-ink hover:text-white" aria-label={t('common.edit')}><Edit3 size={16} /></button>
                          <button onClick={() => deleteCoupon(coupon)} className="rounded-md p-2 transition hover:bg-brand-red hover:text-white" aria-label={t('common.delete')}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.button
              type="button"
              aria-label={t('common.cancel')}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-brand-ink/60 backdrop-blur-sm"
            />
            <motion.form
              onSubmit={submit}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-brand-clay bg-white px-6 py-5">
                <h2 className="font-serif text-2xl font-bold">{t(editing ? 'coupons.edit_title' : 'coupons.create_title')}</h2>
                <button type="button" onClick={closeModal} className="rounded-full p-2 hover:bg-brand-paper"><X size={20} /></button>
              </div>
              <div className="grid gap-5 p-6 md:grid-cols-2">
                <Field label={t('coupons.fields.code')} required>
                  <input required maxLength={50} value={form.code} onChange={(e) => updateField('code', e.target.value.toUpperCase())} className="form-input uppercase" placeholder="WELCOME10" />
                </Field>
                <Field label={t('coupons.fields.type')} required>
                  <select value={form.discount_type} onChange={(e) => updateField('discount_type', e.target.value as CouponForm['discount_type'])} className="form-input">
                    <option value="percentage">{t('coupons.types.percentage')}</option>
                    <option value="fixed">{t('coupons.types.fixed')}</option>
                  </select>
                </Field>
                <Field label={t('coupons.fields.value')} required>
                  <input required type="number" min="0.01" max={form.discount_type === 'percentage' ? '100' : undefined} step="0.01" value={form.discount_value} onChange={(e) => updateField('discount_value', e.target.value)} className="form-input" />
                </Field>
                <Field label={t('coupons.fields.minimum')}>
                  <input type="number" min="0" step="0.01" value={form.minimum_order_amount} onChange={(e) => updateField('minimum_order_amount', e.target.value)} className="form-input" />
                </Field>
                {form.discount_type === 'percentage' && (
                  <Field label={t('coupons.fields.maximum')} hint={t('coupons.optional')}>
                    <input type="number" min="0.01" step="0.01" value={form.maximum_discount_amount} onChange={(e) => updateField('maximum_discount_amount', e.target.value)} className="form-input" />
                  </Field>
                )}
                <Field label={t('coupons.fields.usage_limit')} hint={t('coupons.unlimited_hint')}>
                  <input type="number" min="1" step="1" value={form.usage_limit} onChange={(e) => updateField('usage_limit', e.target.value)} className="form-input" />
                </Field>
                <Field label={t('coupons.fields.per_user')} required>
                  <input required type="number" min="1" step="1" value={form.per_user_limit} onChange={(e) => updateField('per_user_limit', e.target.value)} className="form-input" />
                </Field>
                <Field label={t('coupons.fields.starts_at')} hint={t('coupons.optional')}>
                  <input type="datetime-local" value={form.starts_at} onChange={(e) => updateField('starts_at', e.target.value)} className="form-input" />
                </Field>
                <Field label={t('coupons.fields.expires_at')} hint={t('coupons.optional')}>
                  <input type="datetime-local" value={form.expires_at} onChange={(e) => updateField('expires_at', e.target.value)} className="form-input" />
                </Field>
                <Field label={t('coupons.fields.description')} className="md:col-span-2">
                  <textarea rows={3} value={form.description} onChange={(e) => updateField('description', e.target.value)} className="form-input resize-none" />
                </Field>
                <label className="md:col-span-2 flex cursor-pointer items-center justify-between rounded-lg border border-brand-clay bg-brand-paper/40 p-4">
                  <span><strong className="block text-sm">{t('coupons.fields.active')}</strong><small className="text-brand-ink/50">{t('coupons.active_hint')}</small></span>
                  <input type="checkbox" checked={form.is_active} onChange={(e) => updateField('is_active', e.target.checked)} className="h-5 w-5 accent-brand-red" />
                </label>
              </div>
              <div className="sticky bottom-0 flex justify-end gap-3 border-t border-brand-clay bg-white px-6 py-4">
                <button type="button" onClick={closeModal} className="rounded-md border border-brand-clay px-5 py-2.5 text-sm font-semibold">{t('common.cancel')}</button>
                <button disabled={saving} className="flex items-center gap-2 rounded-md bg-brand-ink px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {saving && <Loader2 size={16} className="animate-spin" />}{t('common.save')}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, hint, required, className = '', children }: { label: string; hint?: string; required?: boolean; className?: string; children: ReactNode }) {
  return (
    <label className={`space-y-2 ${className}`}>
      <span className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-brand-ink/60">
        <span>{label}{required && <span className="ml-1 text-brand-red">*</span>}</span>
        {hint && <small className="font-normal normal-case tracking-normal text-brand-ink/35">{hint}</small>}
      </span>
      {children}
    </label>
  );
}
