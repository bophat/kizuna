import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Edit3,
  Eye,
  Loader2,
  MailCheck,
  Megaphone,
  Package,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

import { apiFetch } from '../lib/api';
import { formatApiErrors } from '../lib/formatApiErrors';

type CampaignStatus = 'draft' | 'sending' | 'sent' | 'partial';

type Campaign = {
  id: number;
  name: string;
  campaign_type: 'event' | 'product';
  product: string | null;
  product_name: string;
  product_image: string;
  subject: string;
  body: string;
  cta_text: string;
  cta_url: string;
  image_url: string;
  status: CampaignStatus;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_by_name: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type ProductOption = {
  id: string;
  name: string;
  image: string;
  status: string;
};

type CampaignForm = {
  name: string;
  campaign_type: 'event' | 'product';
  product: string;
  subject: string;
  body: string;
  cta_text: string;
  cta_url: string;
  image_url: string;
};

const emptyForm: CampaignForm = {
  name: '',
  campaign_type: 'event',
  product: '',
  subject: '',
  body: '',
  cta_text: 'Xem chi tiết',
  cta_url: '',
  image_url: '',
};

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-sm font-semibold text-brand-ink">
        <span>{label}{required && <span className="ml-1 text-brand-red">*</span>}</span>
        {hint && <span className="text-xs font-normal text-brand-ink/40">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function EmailPreview({ form, productName }: { form: CampaignForm; productName?: string }) {
  const { t } = useTranslation();
  return (
    <div className="overflow-hidden rounded-xl border border-brand-clay bg-[#f7f4f1] p-4 shadow-inner">
      <div className="mx-auto max-w-xl overflow-hidden rounded-xl border border-brand-clay bg-white shadow-sm">
        <div className="border-b border-brand-clay px-6 py-4 font-serif text-xl font-bold text-brand-red">KIZUNA</div>
        {form.image_url && (
          <img src={form.image_url} alt="" className="h-48 w-full object-cover" />
        )}
        <div className="space-y-5 p-6">
          <p className="text-sm text-brand-ink/70">{t('marketing.preview_greeting')}</p>
          <div>
            {productName && <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-red">{productName}</p>}
            <h2 className="font-serif text-3xl font-bold leading-tight text-brand-ink">
              {form.subject || t('marketing.preview_subject')}
            </h2>
          </div>
          <p className="whitespace-pre-line text-sm leading-7 text-brand-ink/70">
            {form.body || t('marketing.preview_body')}
          </p>
          <span className="inline-flex rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white">
            {form.cta_text || t('marketing.preview_cta')}
          </span>
          <p className="border-t border-brand-clay pt-4 text-[11px] leading-5 text-brand-ink/40">
            {t('marketing.preview_unsubscribe')}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Marketing() {
  const { t, i18n } = useTranslation();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState<CampaignForm>(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [campaignResponse, productResponse] = await Promise.all([
        apiFetch('/marketing-campaigns/'),
        apiFetch('/products/'),
      ]);
      if (!campaignResponse.ok || !productResponse.ok) throw new Error();
      const [campaignData, productData] = await Promise.all([
        campaignResponse.json(),
        productResponse.json(),
      ]);
      setCampaigns(Array.isArray(campaignData) ? campaignData : campaignData.results || []);
      setProducts(Array.isArray(productData) ? productData : productData.results || []);
      setError('');
    } catch {
      setError(t('marketing.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === form.product),
    [form.product, products],
  );

  const updateCampaign = (updated: Campaign) => {
    setCampaigns((current) => current.map((item) => item.id === updated.id ? updated : item));
  };

  const updateField = <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (campaign: Campaign) => {
    setEditing(campaign);
    setForm({
      name: campaign.name,
      campaign_type: campaign.campaign_type,
      product: campaign.product || '',
      subject: campaign.subject,
      body: campaign.body,
      cta_text: campaign.cta_text,
      cta_url: campaign.cta_url,
      image_url: campaign.image_url || campaign.product_image || '',
    });
    setModalOpen(true);
  };

  const selectProduct = (productId: string) => {
    const product = products.find((item) => item.id === productId);
    setForm((current) => ({
      ...current,
      product: productId,
      image_url: product?.image || current.image_url,
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch(
        editing ? `/marketing-campaigns/${editing.id}/` : '/marketing-campaigns/',
        {
          method: editing ? 'PATCH' : 'POST',
          body: JSON.stringify({
            ...form,
            product: form.campaign_type === 'product' ? form.product : null,
          }),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(formatApiErrors(data));
      }
      setModalOpen(false);
      setNotice(t(editing ? 'marketing.updated' : 'marketing.created'));
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error && submitError.message ? submitError.message : t('marketing.errors.save'));
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async (campaign: Campaign) => {
    const email = window.prompt(t('marketing.test_prompt'));
    if (!email) return;
    setWorkingId(campaign.id);
    setError('');
    try {
      const response = await apiFetch(`/marketing-campaigns/${campaign.id}/send-test/`, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(formatApiErrors(data));
      }
      setNotice(t('marketing.test_sent', { email: email.trim() }));
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : t('marketing.errors.test'));
    } finally {
      setWorkingId(null);
    }
  };

  const runBatches = async (campaign: Campaign, retry = false) => {
    setWorkingId(campaign.id);
    setError('');
    try {
      if (retry) {
        const retryResponse = await apiFetch(`/marketing-campaigns/${campaign.id}/retry-failed/`, { method: 'POST' });
        if (!retryResponse.ok) {
          const data = await retryResponse.json().catch(() => ({}));
          throw new Error(formatApiErrors(data));
        }
      }
      let hasMore = true;
      while (hasMore) {
        const response = await apiFetch(`/marketing-campaigns/${campaign.id}/send-batch/`, {
          method: 'POST',
          body: JSON.stringify({ batch_size: 10 }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(formatApiErrors(data));
        }
        const data = await response.json();
        updateCampaign(data.campaign);
        hasMore = Boolean(data.has_more);
      }
      setNotice(t('marketing.send_complete'));
      await loadData();
    } catch (sendError) {
      setError(sendError instanceof Error && sendError.message ? sendError.message : t('marketing.errors.send'));
      await loadData();
    } finally {
      setWorkingId(null);
    }
  };

  const confirmSend = (campaign: Campaign) => {
    if (!window.confirm(t('marketing.confirm_send', { name: campaign.name }))) return;
    void runBatches(campaign);
  };

  const deleteCampaign = async (campaign: Campaign) => {
    if (!window.confirm(t('marketing.confirm_delete', { name: campaign.name }))) return;
    const response = await apiFetch(`/marketing-campaigns/${campaign.id}/`, { method: 'DELETE' });
    if (response.ok) {
      setNotice(t('marketing.deleted'));
      await loadData();
    } else {
      const data = await response.json().catch(() => ({}));
      setError(formatApiErrors(data) || t('marketing.errors.delete'));
    }
  };

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });
  const statusClass: Record<CampaignStatus, string> = {
    draft: 'bg-zinc-100 text-zinc-600',
    sending: 'bg-blue-100 text-blue-700',
    sent: 'bg-emerald-100 text-emerald-700',
    partial: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="ma-spacing space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-brand-red">{t('marketing.subtitle')}</p>
          <h1 className="flex items-center gap-3 font-serif text-4xl font-bold text-brand-ink">
            <Megaphone size={34} className="text-brand-red" /> {t('marketing.title')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-brand-ink/60">{t('marketing.description')}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-md bg-brand-ink px-6 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-brand-red">
          <Plus size={18} /> {t('marketing.add')}
        </button>
      </div>

      {(error || notice) && (
        <div className={`flex items-center justify-between rounded-md border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          <span className="flex items-center gap-2"><AlertCircle size={17} />{error || notice}</span>
          <button onClick={() => { setError(''); setNotice(''); }}><X size={16} /></button>
        </div>
      )}

      <div className="rounded-lg border border-brand-clay bg-amber-50/60 px-5 py-4 text-sm text-amber-900">
        <strong>{t('marketing.recipient_rule_title')}</strong> {t('marketing.recipient_rule')}
      </div>

      <div className="overflow-hidden rounded-lg border border-brand-clay bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-brand-ink/50"><Loader2 className="animate-spin text-brand-red" />{t('common.loading')}</div>
        ) : campaigns.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-brand-ink/40"><Megaphone size={44} /><p className="font-serif text-lg italic">{t('marketing.empty')}</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-brand-paper text-[10px] uppercase tracking-wider text-brand-ink/50">
                <tr>
                  <th className="px-6 py-4">{t('marketing.table.campaign')}</th>
                  <th className="px-6 py-4">{t('marketing.table.type')}</th>
                  <th className="px-6 py-4">{t('marketing.table.progress')}</th>
                  <th className="px-6 py-4">{t('marketing.table.status')}</th>
                  <th className="px-6 py-4">{t('marketing.table.created')}</th>
                  <th className="px-6 py-4 text-right">{t('marketing.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-clay">
                {campaigns.map((campaign) => {
                  const isWorking = workingId === campaign.id;
                  const progress = campaign.recipient_count ? Math.round((campaign.sent_count / campaign.recipient_count) * 100) : 0;
                  return (
                    <tr key={campaign.id} className="transition hover:bg-brand-paper/40">
                      <td className="max-w-sm px-6 py-4">
                        <p className="font-semibold text-brand-ink">{campaign.name}</p>
                        <p className="mt-1 truncate text-xs text-brand-ink/50">{campaign.subject}</p>
                        {campaign.product_name && <p className="mt-1 text-xs font-semibold text-brand-red">{campaign.product_name}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm"><span className="inline-flex items-center gap-2">{campaign.campaign_type === 'product' ? <Package size={15} /> : <Megaphone size={15} />}{t(`marketing.types.${campaign.campaign_type}`)}</span></td>
                      <td className="min-w-44 px-6 py-4">
                        <p className="text-sm font-semibold">{campaign.sent_count} / {campaign.recipient_count || '—'}</p>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-clay"><div className="h-full bg-brand-red transition-all" style={{ width: `${progress}%` }} /></div>
                        {campaign.failed_count > 0 && <p className="mt-1 text-xs text-red-600">{t('marketing.failed_count', { count: campaign.failed_count })}</p>}
                      </td>
                      <td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass[campaign.status]}`}>{t(`marketing.status.${campaign.status}`)}</span></td>
                      <td className="px-6 py-4 text-xs text-brand-ink/55">{dateFormatter.format(new Date(campaign.created_at))}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1">
                          {isWorking ? <Loader2 className="m-2 animate-spin text-brand-red" size={18} /> : (
                            <>
                              <button onClick={() => sendTest(campaign)} className="rounded-md p-2 hover:bg-brand-paper" title={t('marketing.send_test')}><MailCheck size={17} /></button>
                              {campaign.status === 'draft' && <button onClick={() => openEdit(campaign)} className="rounded-md p-2 hover:bg-brand-paper" title={t('common.edit')}><Edit3 size={17} /></button>}
                              {campaign.status === 'draft' && <button onClick={() => confirmSend(campaign)} className="rounded-md p-2 text-brand-red hover:bg-brand-red hover:text-white" title={t('marketing.send_all')}><Send size={17} /></button>}
                              {campaign.status === 'sending' && <button onClick={() => runBatches(campaign)} className="rounded-md p-2 text-blue-700 hover:bg-blue-100" title={t('marketing.continue_send')}><Send size={17} /></button>}
                              {campaign.status === 'partial' && <button onClick={() => runBatches(campaign, true)} className="rounded-md p-2 text-amber-700 hover:bg-amber-100" title={t('marketing.retry')}><RotateCcw size={17} /></button>}
                              {campaign.status === 'draft' && <button onClick={() => deleteCampaign(campaign)} className="rounded-md p-2 hover:bg-brand-red hover:text-white" title={t('common.delete')}><Trash2 size={17} /></button>}
                            </>
                          )}
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
            <motion.button type="button" aria-label={t('common.cancel')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !saving && setModalOpen(false)} className="absolute inset-0 bg-brand-ink/60 backdrop-blur-sm" />
            <motion.form onSubmit={submit} initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.98 }} className="relative max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-brand-clay bg-white px-6 py-5">
                <div><p className="text-xs font-bold uppercase tracking-widest text-brand-red">{t('marketing.builder')}</p><h2 className="font-serif text-2xl font-bold">{t(editing ? 'marketing.edit_title' : 'marketing.create_title')}</h2></div>
                <button type="button" onClick={() => !saving && setModalOpen(false)} className="rounded-full p-2 hover:bg-brand-paper"><X size={20} /></button>
              </div>
              <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,1fr)]">
                <div className="space-y-5">
                  <Field label={t('marketing.fields.name')} required><input required maxLength={200} value={form.name} onChange={(e) => updateField('name', e.target.value)} className="form-input" /></Field>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label={t('marketing.fields.type')} required><select value={form.campaign_type} onChange={(e) => updateField('campaign_type', e.target.value as CampaignForm['campaign_type'])} className="form-input"><option value="event">{t('marketing.types.event')}</option><option value="product">{t('marketing.types.product')}</option></select></Field>
                    {form.campaign_type === 'product' && <Field label={t('marketing.fields.product')} required><select required value={form.product} onChange={(e) => selectProduct(e.target.value)} className="form-input"><option value="">{t('marketing.select_product')}</option>{products.filter((product) => product.status === 'published').map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></Field>}
                  </div>
                  <Field label={t('marketing.fields.subject')} required><input required maxLength={255} value={form.subject} onChange={(e) => updateField('subject', e.target.value)} className="form-input" /></Field>
                  <Field label={t('marketing.fields.body')} required><textarea required rows={8} value={form.body} onChange={(e) => updateField('body', e.target.value)} className="form-input resize-y" /></Field>
                  <div className="grid gap-5 sm:grid-cols-2"><Field label={t('marketing.fields.cta_text')}><input maxLength={100} value={form.cta_text} onChange={(e) => updateField('cta_text', e.target.value)} className="form-input" /></Field><Field label={t('marketing.fields.cta_url')} hint={form.campaign_type === 'product' ? t('marketing.auto_product_link') : undefined}><input type="url" value={form.cta_url} onChange={(e) => updateField('cta_url', e.target.value)} className="form-input" placeholder="https://..." /></Field></div>
                  <Field label={t('marketing.fields.image_url')} hint={t('marketing.optional')}><input type="url" value={form.image_url} onChange={(e) => updateField('image_url', e.target.value)} className="form-input" placeholder="https://..." /></Field>
                </div>
                <div><p className="mb-3 flex items-center gap-2 text-sm font-bold text-brand-ink"><Eye size={17} className="text-brand-red" />{t('marketing.preview')}</p><EmailPreview form={form} productName={selectedProduct?.name} /></div>
              </div>
              <div className="sticky bottom-0 flex justify-end gap-3 border-t border-brand-clay bg-white px-6 py-4"><button type="button" onClick={() => !saving && setModalOpen(false)} className="rounded-md border border-brand-clay px-5 py-2.5 text-sm font-semibold hover:bg-brand-paper">{t('common.cancel')}</button><button disabled={saving} className="flex items-center gap-2 rounded-md bg-brand-ink px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-red disabled:opacity-50">{saving && <Loader2 size={16} className="animate-spin" />}{t('marketing.save_draft')}</button></div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
