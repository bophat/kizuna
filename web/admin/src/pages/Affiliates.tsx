import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BadgeDollarSign,
  CheckCircle2,
  Edit3,
  Link2,
  Loader2,
  MousePointerClick,
  Plus,
  RefreshCw,
  Search,
  UsersRound,
  WalletCards,
  X,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

import { apiFetch } from '../lib/api';
import { formatApiErrors } from '../lib/formatApiErrors';
import { useFormatPrice } from '../hooks/useFormatPrice';

type Affiliate = {
  id: number;
  user: number;
  user_details: { id: number; email: string; username: string; first_name: string; last_name: string };
  code: string;
  status: 'pending' | 'active' | 'suspended';
  commission_rate: string;
  cookie_days: number;
  internal_notes: string;
  visits_count: number;
  orders_count: number;
  pending_amount: string;
  available_amount: string;
  paid_amount: string;
  payout_details: { bank_name: string; account_name: string; account_number: string; configured: boolean };
};

type Commission = {
  id: number;
  affiliate: number;
  affiliate_code: string;
  order: number;
  customer_email: string;
  status: 'pending' | 'available' | 'paid' | 'reversed';
  base_amount: string;
  commission_rate: string;
  amount: string;
  available_at: string | null;
  created_at: string;
};

type Payout = {
  id: number;
  affiliate: number;
  affiliate_code: string;
  status: 'draft' | 'paid' | 'cancelled';
  total_amount: string;
  commission_count: number;
  transaction_reference: string;
  paid_at: string | null;
  created_at: string;
};

type User = { id: number; email: string; username: string; first_name: string; last_name: string; is_staff: boolean };

type AffiliateForm = {
  user: string;
  code: string;
  status: Affiliate['status'];
  commission_rate: string;
  cookie_days: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  internal_notes: string;
};

const emptyForm: AffiliateForm = {
  user: '', code: '', status: 'active', commission_rate: '8', cookie_days: '30',
  bank_name: '', account_name: '', account_number: '', internal_notes: '',
};

function listFromResponse<T>(data: T[] | { results?: T[] }) {
  return Array.isArray(data) ? data : data.results || [];
}

export default function Affiliates() {
  const { t, i18n } = useTranslation();
  const { format: formatPrice } = useFormatPrice();
  const [tab, setTab] = useState<'affiliates' | 'commissions' | 'payouts'>('affiliates');
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Affiliate | null>(null);
  const [form, setForm] = useState<AffiliateForm>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const responses = await Promise.all([
        apiFetch('/affiliates/'),
        apiFetch('/affiliate-commissions/'),
        apiFetch('/affiliate-payouts/'),
        apiFetch('/users/?is_staff=false'),
      ]);
      if (responses.some((response) => !response.ok)) throw new Error();
      const [affiliateData, commissionData, payoutData, userData] = await Promise.all(
        responses.map((response) => response.json()),
      );
      setAffiliates(listFromResponse<Affiliate>(affiliateData));
      setCommissions(listFromResponse<Commission>(commissionData));
      setPayouts(listFromResponse<Payout>(payoutData));
      setUsers(listFromResponse<User>(userData));
      setError('');
    } catch {
      setError(t('affiliates.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const filteredAffiliates = useMemo(() => {
    const query = search.trim().toLowerCase();
    return affiliates.filter((affiliate) => !query || `${affiliate.code} ${affiliate.user_details.email} ${affiliate.user_details.first_name} ${affiliate.user_details.last_name}`.toLowerCase().includes(query));
  }, [affiliates, search]);

  const totals = useMemo(() => ({
    visits: affiliates.reduce((sum, item) => sum + item.visits_count, 0),
    orders: affiliates.reduce((sum, item) => sum + item.orders_count, 0),
    pending: affiliates.reduce((sum, item) => sum + Number(item.pending_amount), 0),
    available: affiliates.reduce((sum, item) => sum + Number(item.available_amount), 0),
    paid: affiliates.reduce((sum, item) => sum + Number(item.paid_amount), 0),
  }), [affiliates]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (affiliate: Affiliate) => {
    setEditing(affiliate);
    setForm({
      user: String(affiliate.user),
      code: affiliate.code,
      status: affiliate.status,
      commission_rate: affiliate.commission_rate,
      cookie_days: String(affiliate.cookie_days),
      bank_name: '', account_name: '', account_number: '',
      internal_notes: affiliate.internal_notes || '',
    });
    setModalOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        user: Number(form.user),
        code: form.code.trim().toUpperCase(),
        status: form.status,
        commission_rate: form.commission_rate,
        cookie_days: Number(form.cookie_days),
        internal_notes: form.internal_notes,
      };
      if (form.account_number.trim()) {
        payload.bank_name = form.bank_name;
        payload.account_name = form.account_name;
        payload.account_number = form.account_number;
      }
      const response = await apiFetch(editing ? `/affiliates/${editing.id}/` : '/affiliates/', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(formatApiErrors(await response.json().catch(() => ({}))));
      setModalOpen(false);
      setNotice(t(editing ? 'affiliates.updated' : 'affiliates.created'));
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error && submitError.message ? submitError.message : t('affiliates.errors.save'));
    } finally {
      setSaving(false);
    }
  };

  const createPayout = async (affiliate: Affiliate) => {
    if (!window.confirm(t('affiliates.confirm_payout', { code: affiliate.code, amount: formatPrice(affiliate.available_amount) }))) return;
    const response = await apiFetch('/affiliate-payouts/create-from-available/', {
      method: 'POST', body: JSON.stringify({ affiliate: affiliate.id }),
    });
    if (!response.ok) {
      setError(formatApiErrors(await response.json().catch(() => ({}))) || t('affiliates.errors.payout'));
      return;
    }
    setNotice(t('affiliates.payout_created'));
    setTab('payouts');
    await load();
  };

  const markPaid = async (payout: Payout) => {
    const reference = window.prompt(t('affiliates.transaction_prompt'))?.trim();
    if (!reference) return;
    const response = await apiFetch(`/affiliate-payouts/${payout.id}/mark-paid/`, {
      method: 'POST', body: JSON.stringify({ transaction_reference: reference }),
    });
    if (!response.ok) {
      setError(formatApiErrors(await response.json().catch(() => ({}))));
      return;
    }
    setNotice(t('affiliates.payout_paid'));
    await load();
  };

  const cancelPayout = async (payout: Payout) => {
    if (!window.confirm(t('affiliates.confirm_cancel_payout'))) return;
    const response = await apiFetch(`/affiliate-payouts/${payout.id}/cancel/`, { method: 'POST' });
    if (response.ok) {
      setNotice(t('affiliates.payout_cancelled'));
      await load();
    } else {
      setError(formatApiErrors(await response.json().catch(() => ({}))));
    }
  };

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="ma-spacing space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-brand-red">{t('affiliates.subtitle')}</p><h1 className="flex items-center gap-3 text-4xl font-bold font-serif"><UsersRound className="text-brand-red" size={34} />{t('affiliates.title')}</h1><p className="mt-2 max-w-2xl text-sm text-brand-ink/55">{t('affiliates.description')}</p></div>
        <div className="flex gap-2"><button onClick={() => void load()} className="rounded-md border border-brand-clay bg-white p-3" aria-label={t('common.try_again')}><RefreshCw size={18} /></button><button onClick={openCreate} className="flex items-center gap-2 rounded-md bg-brand-ink px-6 py-3 text-sm font-semibold text-white hover:bg-brand-red"><Plus size={18} />{t('affiliates.add')}</button></div>
      </div>

      {(error || notice) && <div className={`flex items-center justify-between rounded-md border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}><span className="flex items-center gap-2"><AlertCircle size={17} />{error || notice}</span><button onClick={() => { setError(''); setNotice(''); }}><X size={16} /></button></div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric icon={MousePointerClick} label={t('affiliates.metrics.visits')} value={totals.visits} />
        <Metric icon={Link2} label={t('affiliates.metrics.orders')} value={totals.orders} />
        <Metric icon={WalletCards} label={t('affiliates.metrics.pending')} value={formatPrice(totals.pending)} />
        <Metric icon={BadgeDollarSign} label={t('affiliates.metrics.available')} value={formatPrice(totals.available)} accent />
        <Metric icon={CheckCircle2} label={t('affiliates.metrics.paid')} value={formatPrice(totals.paid)} />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-brand-clay">
        {(['affiliates', 'commissions', 'payouts'] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`whitespace-nowrap border-b-2 px-5 py-3 text-sm font-semibold ${tab === item ? 'border-brand-red text-brand-red' : 'border-transparent text-brand-ink/50'}`}>{t(`affiliates.tabs.${item}`)}</button>)}
      </div>

      {loading ? <div className="flex min-h-72 items-center justify-center"><Loader2 className="animate-spin text-brand-red" size={36} /></div> : (
        <>
          {tab === 'affiliates' && <section className="overflow-hidden rounded-lg border border-brand-clay bg-white shadow-sm"><div className="border-b border-brand-clay p-4"><div className="relative max-w-md"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/30" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('affiliates.search')} className="w-full rounded-md border border-brand-clay py-2 pl-10 pr-4 text-sm outline-none focus:border-brand-red" /></div></div><div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-brand-paper text-[10px] uppercase tracking-wider text-brand-ink/50"><tr><th className="px-5 py-4">{t('affiliates.table.affiliate')}</th><th className="px-5 py-4">{t('affiliates.table.performance')}</th><th className="px-5 py-4">{t('affiliates.table.commission')}</th><th className="px-5 py-4">{t('affiliates.table.payout')}</th><th className="px-5 py-4">{t('affiliates.table.status')}</th><th className="px-5 py-4 text-right">{t('affiliates.table.actions')}</th></tr></thead><tbody className="divide-y divide-brand-clay">{filteredAffiliates.map((affiliate) => <tr key={affiliate.id} className="hover:bg-brand-paper/30"><td className="px-5 py-4"><code className="rounded bg-brand-red/10 px-2 py-1 font-bold text-brand-red">{affiliate.code}</code><p className="mt-2 text-sm font-semibold">{affiliate.user_details.first_name || affiliate.user_details.username} {affiliate.user_details.last_name}</p><p className="text-xs text-brand-ink/45">{affiliate.user_details.email}</p></td><td className="px-5 py-4 text-sm"><p>{t('affiliates.visits_orders', { visits: affiliate.visits_count, orders: affiliate.orders_count })}</p></td><td className="px-5 py-4"><strong>{Number(affiliate.commission_rate)}%</strong><p className="mt-1 text-xs text-brand-ink/45">{t('affiliates.cookie_days', { count: affiliate.cookie_days })}</p></td><td className="px-5 py-4"><strong className="text-emerald-700">{formatPrice(affiliate.available_amount)}</strong><p className="mt-1 text-xs text-brand-ink/45">{affiliate.payout_details.configured ? `${affiliate.payout_details.bank_name} · ${affiliate.payout_details.account_number}` : t('affiliates.no_bank')}</p></td><td className="px-5 py-4"><StatusBadge status={affiliate.status} label={t(`affiliates.status.${affiliate.status}`)} /></td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => openEdit(affiliate)} className="rounded p-2 hover:bg-brand-ink hover:text-white"><Edit3 size={16} /></button><button disabled={!affiliate.payout_details.configured || Number(affiliate.available_amount) <= 0} onClick={() => void createPayout(affiliate)} className="rounded bg-brand-red px-3 py-2 text-xs font-semibold text-white disabled:opacity-30">{t('affiliates.pay')}</button></div></td></tr>)}</tbody></table></div></section>}

          {tab === 'commissions' && <DataTable headers={[t('affiliates.commissions.order'), t('affiliates.commissions.affiliate'), t('affiliates.commissions.customer'), t('affiliates.commissions.base'), t('affiliates.commissions.amount'), t('affiliates.commissions.status'), t('affiliates.commissions.date')]} rows={commissions.map((item) => [<strong>#{item.order}</strong>, <code>{item.affiliate_code}</code>, item.customer_email, formatPrice(item.base_amount), <strong className="text-brand-red">{formatPrice(item.amount)}</strong>, <StatusBadge status={item.status} label={t(`affiliates.commission_status.${item.status}`)} />, dateFormatter.format(new Date(item.created_at))])} empty={t('affiliates.commissions.empty')} />}

          {tab === 'payouts' && <DataTable headers={[t('affiliates.payouts.id'), t('affiliates.payouts.affiliate'), t('affiliates.payouts.amount'), t('affiliates.payouts.items'), t('affiliates.payouts.status'), t('affiliates.payouts.reference'), t('affiliates.table.actions')]} rows={payouts.map((item) => [<strong>#{item.id}</strong>, <code>{item.affiliate_code}</code>, <strong>{formatPrice(item.total_amount)}</strong>, item.commission_count, <StatusBadge status={item.status} label={t(`affiliates.payout_status.${item.status}`)} />, item.transaction_reference || '—', item.status === 'draft' ? <div className="flex gap-2"><button onClick={() => void markPaid(item)} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">{t('affiliates.mark_paid')}</button><button onClick={() => void cancelPayout(item)} className="rounded border border-red-200 p-1.5 text-red-600"><XCircle size={15} /></button></div> : '—'])} empty={t('affiliates.payouts.empty')} />}
        </>
      )}

      <AnimatePresence>{modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><motion.button type="button" aria-label={t('common.cancel')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !saving && setModalOpen(false)} className="absolute inset-0 bg-brand-ink/60 backdrop-blur-sm" /><motion.form onSubmit={submit} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-brand-clay bg-white px-6 py-5"><h2 className="font-serif text-2xl font-bold">{t(editing ? 'affiliates.edit_title' : 'affiliates.create_title')}</h2><button type="button" onClick={() => setModalOpen(false)}><X /></button></div><div className="grid gap-5 p-6 md:grid-cols-2"><Field label={t('affiliates.fields.user')} required><select required disabled={!!editing} value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} className="form-input"><option value="">{t('affiliates.select_user')}</option>{users.filter((user) => editing?.user === user.id || !affiliates.some((affiliate) => affiliate.user === user.id)).map((user) => <option key={user.id} value={user.id}>{user.email || user.username}</option>)}</select></Field><Field label={t('affiliates.fields.code')} required><input required maxLength={40} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="form-input uppercase" placeholder="KENJI001" /></Field><Field label={t('affiliates.fields.status')} required><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Affiliate['status'] })} className="form-input"><option value="pending">{t('affiliates.status.pending')}</option><option value="active">{t('affiliates.status.active')}</option><option value="suspended">{t('affiliates.status.suspended')}</option></select></Field><Field label={t('affiliates.fields.rate')} required><input required type="number" min="0" max="100" step="0.01" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: e.target.value })} className="form-input" /></Field><Field label={t('affiliates.fields.cookie_days')} required><input required type="number" min="1" max="365" value={form.cookie_days} onChange={(e) => setForm({ ...form, cookie_days: e.target.value })} className="form-input" /></Field><div className="md:col-span-2 border-t border-brand-clay pt-5"><h3 className="mb-1 font-semibold">{t('affiliates.bank_title')}</h3><p className="mb-4 text-xs text-brand-ink/45">{editing?.payout_details.configured ? t('affiliates.bank_replace_hint', { account: editing.payout_details.account_number }) : t('affiliates.bank_hint')}</p><div className="grid gap-4 md:grid-cols-3"><Field label={t('affiliates.fields.bank_name')}><input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} className="form-input" /></Field><Field label={t('affiliates.fields.account_name')}><input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} className="form-input" /></Field><Field label={t('affiliates.fields.account_number')}><input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} className="form-input" autoComplete="off" /></Field></div></div><Field label={t('affiliates.fields.notes')} className="md:col-span-2"><textarea rows={3} value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} className="form-input resize-none" /></Field></div><div className="sticky bottom-0 flex justify-end gap-3 border-t border-brand-clay bg-white px-6 py-4"><button type="button" onClick={() => setModalOpen(false)} className="rounded border border-brand-clay px-5 py-2.5 text-sm font-semibold">{t('common.cancel')}</button><button disabled={saving} className="flex items-center gap-2 rounded bg-brand-ink px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving && <Loader2 size={16} className="animate-spin" />}{t('common.save')}</button></div></motion.form></div>}</AnimatePresence>
    </div>
  );
}

function Metric({ icon: Icon, label, value, accent = false }: { icon: typeof UsersRound; label: string; value: ReactNode; accent?: boolean }) {
  return <div className={`rounded-lg border p-5 shadow-sm ${accent ? 'border-emerald-200 bg-emerald-50' : 'border-brand-clay bg-white'}`}><Icon size={20} className={accent ? 'text-emerald-700' : 'text-brand-red'} /><p className="mt-4 text-2xl font-bold font-serif">{value}</p><p className="mt-1 text-xs text-brand-ink/45">{label}</p></div>;
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const color = status === 'active' || status === 'available' || status === 'paid' ? 'bg-emerald-100 text-emerald-700' : status === 'pending' || status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-600';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{label}</span>;
}

function DataTable({ headers, rows, empty }: { headers: string[]; rows: ReactNode[][]; empty: string }) {
  return <section className="overflow-hidden rounded-lg border border-brand-clay bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-brand-paper text-[10px] uppercase tracking-wider text-brand-ink/50"><tr>{headers.map((header) => <th key={header} className="px-5 py-4">{header}</th>)}</tr></thead><tbody className="divide-y divide-brand-clay">{rows.map((row, index) => <tr key={index} className="hover:bg-brand-paper/30">{row.map((cell, cellIndex) => <td key={cellIndex} className="whitespace-nowrap px-5 py-4">{cell}</td>)}</tr>)}</tbody></table>{rows.length === 0 && <p className="p-12 text-center text-brand-ink/40">{empty}</p>}</div></section>;
}

function Field({ label, required, className = '', children }: { label: string; required?: boolean; className?: string; children: ReactNode }) {
  return <label className={`space-y-2 ${className}`}><span className="text-xs font-bold uppercase tracking-wider text-brand-ink/55">{label}{required && <span className="ml-1 text-brand-red">*</span>}</span>{children}</label>;
}
