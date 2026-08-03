import { type ReactNode, useEffect, useState } from 'react';
import { Banknote, Landmark, Loader2, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { apiFetch } from '../../lib/api';
import { formatApiErrors } from '../../lib/formatApiErrors';
import { toast } from '@izuna/shared/lib/toast';

type PaymentMethod = {
  id: number;
  code: 'cod' | 'bank_transfer';
  enabled: boolean;
  instructions_en: string;
  instructions_ja: string;
  instructions_vi: string;
  bank_name: string;
  bank_bin: string;
  account_name: string;
  account_number: string;
  currency: string;
  expiry_minutes: number;
  sort_order: number;
};

export function PaymentSettingsSection() {
  const { t } = useTranslation();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch('/payment-methods/')
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        setMethods(Array.isArray(data) ? data : data.results || []);
      })
      .catch(() => toast.error(t('settings.payments.load_failed')))
      .finally(() => setLoading(false));
  }, [t]);

  const update = (code: PaymentMethod['code'], patch: Partial<PaymentMethod>) => {
    setMethods((current) => current.map((item) => (
      item.code === code ? { ...item, ...patch } : item
    )));
  };

  const save = async () => {
    const bank = methods.find((method) => method.code === 'bank_transfer');
    if (
      bank?.enabled
      && [bank.bank_name, bank.bank_bin, bank.account_name, bank.account_number]
        .some((value) => !value.trim())
    ) {
      toast.error(t('settings.payments.required_bank_fields'));
      return;
    }
    if (methods.some((method) => method.expiry_minutes < 5 || method.expiry_minutes > 10080)) {
      toast.error(t('settings.payments.invalid_expiry'));
      return;
    }
    setSaving(true);
    try {
      for (const method of methods) {
        const response = await apiFetch(`/payment-methods/${method.id}/`, {
          method: 'PATCH',
          body: JSON.stringify(method),
        });
        if (!response.ok) {
          throw new Error(formatApiErrors(await response.json().catch(() => ({}))));
        }
      }
      toast.success(t('settings.payments.saved'));
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t('settings.payments.save_failed'),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center rounded-xl border border-brand-clay bg-white p-10"><Loader2 className="animate-spin text-brand-red" /></div>;
  }

  const cod = methods.find((item) => item.code === 'cod');
  const bank = methods.find((item) => item.code === 'bank_transfer');
  if (!cod || !bank) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-brand-clay bg-white shadow-sm">
      <div className="border-b border-brand-clay p-8">
        <h3 className="text-lg font-bold font-serif">{t('settings.payments.title')}</h3>
        <p className="mt-1 text-sm text-brand-ink/50">{t('settings.payments.description')}</p>
      </div>

      <div className="space-y-8 p-8">
        <MethodHeader
          icon={<Banknote size={20} />}
          title={t('settings.payments.cod')}
          enabled={cod.enabled}
          onToggle={(enabled) => update('cod', { enabled })}
        />
        <LocalizedInstructions method={cod} update={update} />

        <div className="border-t border-brand-clay pt-8">
          <MethodHeader
            icon={<Landmark size={20} />}
            title={t('settings.payments.bank_transfer')}
            enabled={bank.enabled}
            onToggle={(enabled) => update('bank_transfer', { enabled })}
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label={t('settings.payments.bank_name')}><input className="form-input" value={bank.bank_name} onChange={(e) => update('bank_transfer', { bank_name: e.target.value })} /></Field>
            <Field label={t('settings.payments.bank_bin')}><input className="form-input" value={bank.bank_bin} onChange={(e) => update('bank_transfer', { bank_bin: e.target.value.replace(/\D/g, '') })} placeholder="970436" /></Field>
            <Field label={t('settings.payments.account_name')}><input className="form-input uppercase" value={bank.account_name} onChange={(e) => update('bank_transfer', { account_name: e.target.value })} /></Field>
            <Field label={t('settings.payments.account_number')}><input className="form-input" value={bank.account_number} onChange={(e) => update('bank_transfer', { account_number: e.target.value.replace(/\s/g, '') })} /></Field>
            <Field label={t('settings.payments.currency')}><select className="form-input" value={bank.currency} onChange={(e) => update('bank_transfer', { currency: e.target.value })}><option value="VND">VND</option></select></Field>
            <Field label={t('settings.payments.expiry')}><input className="form-input" type="number" min={5} max={10080} value={bank.expiry_minutes} onChange={(e) => update('bank_transfer', { expiry_minutes: Number(e.target.value) })} /></Field>
          </div>
          <div className="mt-5"><LocalizedInstructions method={bank} update={update} /></div>
        </div>
      </div>

      <div className="flex justify-end border-t border-brand-clay bg-brand-paper/20 px-8 py-5">
        <button onClick={() => void save()} disabled={saving} className="flex items-center gap-2 rounded-md bg-brand-ink px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
          {t('settings.payments.save')}
        </button>
      </div>
    </section>
  );
}

function MethodHeader({ icon, title, enabled, onToggle }: { icon: ReactNode; title: string; enabled: boolean; onToggle: (value: boolean) => void }) {
  const { t } = useTranslation();
  return <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3 font-semibold">{icon}{title}</div><label className="flex cursor-pointer items-center gap-3 text-sm"><span>{t(enabled ? 'settings.payments.enabled' : 'settings.payments.disabled')}</span><input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} className="h-5 w-5 accent-brand-red" /></label></div>;
}

function LocalizedInstructions({ method, update }: { method: PaymentMethod; update: (code: PaymentMethod['code'], patch: Partial<PaymentMethod>) => void }) {
  const { t } = useTranslation();
  return <div className="grid gap-4 md:grid-cols-3">{(['en', 'ja', 'vi'] as const).map((language) => { const key = `instructions_${language}` as const; return <div key={language}><Field label={t(`settings.payments.instructions_${language}`)}><textarea rows={3} className="form-input resize-none" value={method[key]} onChange={(e) => update(method.code, { [key]: e.target.value })} /></Field></div>; })}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-wider text-brand-ink/55">{label}</span>{children}</label>;
}
