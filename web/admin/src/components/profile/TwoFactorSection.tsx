import React from 'react';
import QRCode from 'qrcode';
import { ShieldCheck, ShieldOff, Loader2, Copy, Check, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/api';

type Status = {
  enabled: boolean;
  pending_setup: boolean;
  recovery_codes_remaining: number;
};

/**
 * Enrol in / remove the TOTP second factor.
 *
 * The QR is rendered in this browser from the otpauth URI. It is never sent to
 * an image service the way the bank-transfer QR is — that URI contains the
 * shared secret, which is the whole credential.
 */
export function TwoFactorSection() {
  const { t } = useTranslation();

  const [status, setStatus] = React.useState<Status | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [secret, setSecret] = React.useState('');
  const [qrDataUrl, setQrDataUrl] = React.useState('');
  const [code, setCode] = React.useState('');
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[]>([]);
  const [copied, setCopied] = React.useState(false);

  const [disarmPassword, setDisarmPassword] = React.useState('');
  const [showDisable, setShowDisable] = React.useState(false);

  const loadStatus = React.useCallback(async () => {
    try {
      const res = await apiFetch('/2fa/status/');
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadStatus(); }, [loadStatus]);

  const beginSetup = async () => {
    setBusy(true);
    setError(null);
    setRecoveryCodes([]);
    try {
      const res = await apiFetch('/2fa/setup/', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || t('two_factor.errors.setup_failed'));
        return;
      }
      setSecret(data.secret);
      setQrDataUrl(await QRCode.toDataURL(data.otpauth_uri, { width: 220, margin: 1 }));
    } catch {
      setError(t('two_factor.errors.setup_failed'));
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch('/2fa/confirm/', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || t('two_factor.errors.invalid_code'));
        return;
      }
      setRecoveryCodes(data.recovery_codes || []);
      setSecret('');
      setQrDataUrl('');
      setCode('');
      await loadStatus();
    } catch {
      setError(t('two_factor.errors.invalid_code'));
    } finally {
      setBusy(false);
    }
  };

  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch('/2fa/disable/', {
        method: 'POST',
        body: JSON.stringify({ password: disarmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || t('two_factor.errors.disable_failed'));
        return;
      }
      setDisarmPassword('');
      setShowDisable(false);
      await loadStatus();
    } catch {
      setError(t('two_factor.errors.disable_failed'));
    } finally {
      setBusy(false);
    }
  };

  const copyRecoveryCodes = async () => {
    await navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-brand-clay shadow-sm p-8 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-red" />
      </div>
    );
  }

  const isEnabled = status?.enabled;

  return (
    <section className="bg-white rounded-xl border border-brand-clay shadow-sm overflow-hidden">
      <header className="flex items-start justify-between gap-4 border-b border-brand-clay p-8">
        <div className="flex gap-4">
          <div className={`rounded-lg p-3 ${isEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-paper text-brand-ink/40'}`}>
            {isEnabled ? <ShieldCheck size={24} /> : <ShieldOff size={24} />}
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold text-brand-ink">{t('two_factor.title')}</h2>
            <p className="text-sm text-brand-ink/50 mt-1 max-w-lg">{t('two_factor.description')}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
            isEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-paper text-brand-ink/40'
          }`}
        >
          {isEnabled ? t('two_factor.status_on') : t('two_factor.status_off')}
        </span>
      </header>

      <div className="p-8 space-y-6">
        {error && (
          <div className="flex items-center gap-3 rounded-md border border-brand-red/20 bg-red-50 p-4 text-xs font-bold uppercase tracking-wider text-brand-red">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Shown once, right after enrolling. */}
        {recoveryCodes.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-6">
            <p className="font-bold text-brand-ink mb-1">{t('two_factor.recovery_title')}</p>
            <p className="text-sm text-brand-ink/60 mb-4">{t('two_factor.recovery_body')}</p>
            <ul className="grid grid-cols-2 gap-2 font-mono text-sm mb-4">
              {recoveryCodes.map((rc) => <li key={rc} className="bg-white rounded px-3 py-2 border border-amber-200">{rc}</li>)}
            </ul>
            <button
              onClick={copyRecoveryCodes}
              className="inline-flex items-center gap-2 rounded-md border border-brand-clay bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-brand-paper transition-colors"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t('two_factor.copied') : t('two_factor.copy_codes')}
            </button>
          </div>
        )}

        {!isEnabled && !qrDataUrl && (
          <button
            onClick={beginSetup}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-brand-ink px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-brand-red disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {t('two_factor.enable')}
          </button>
        )}

        {!isEnabled && qrDataUrl && (
          <form onSubmit={confirmSetup} className="space-y-5">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <img
                src={qrDataUrl}
                alt={t('two_factor.qr_alt')}
                width={220}
                height={220}
                className="rounded-lg border border-brand-clay bg-white p-2"
              />
              <div className="flex-1 space-y-3">
                <p className="text-sm text-brand-ink/70">{t('two_factor.scan_instructions')}</p>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-brand-ink/40 mb-1">
                    {t('two_factor.manual_key')}
                  </p>
                  <code className="block break-all rounded bg-brand-paper px-3 py-2 font-mono text-xs">{secret}</code>
                </div>
              </div>
            </div>

            <div className="space-y-2 max-w-xs">
              <label className="text-[10px] uppercase tracking-widest font-bold text-brand-ink/40">
                {t('two_factor.code_label')}
              </label>
              <input
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
                className="w-full rounded-md border border-brand-clay bg-white px-4 py-3 text-sm tracking-[0.3em] shadow-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red/10"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-md bg-brand-ink px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-brand-red disabled:opacity-50"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                {t('two_factor.confirm')}
              </button>
              <button
                type="button"
                onClick={() => { setQrDataUrl(''); setSecret(''); setCode(''); setError(null); }}
                className="rounded-md border border-brand-clay px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-brand-ink/60 transition-colors hover:bg-brand-paper"
              >
                {t('two_factor.cancel')}
              </button>
            </div>
          </form>
        )}

        {isEnabled && (
          <div className="space-y-4">
            <p className="text-sm text-brand-ink/60">
              {t('two_factor.recovery_remaining', { count: status?.recovery_codes_remaining ?? 0 })}
            </p>

            {!showDisable ? (
              <button
                onClick={() => setShowDisable(true)}
                className="rounded-md border border-brand-red/30 px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-brand-red transition-colors hover:bg-red-50"
              >
                {t('two_factor.disable')}
              </button>
            ) : (
              <form onSubmit={disable} className="max-w-xs space-y-3">
                <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-ink/40">
                  {t('two_factor.confirm_password')}
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={disarmPassword}
                  onChange={(e) => setDisarmPassword(e.target.value)}
                  className="w-full rounded-md border border-brand-clay bg-white px-4 py-3 text-sm shadow-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red/10"
                />
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-md bg-brand-red px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {busy && <Loader2 size={14} className="animate-spin" />}
                    {t('two_factor.disable_confirm')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDisable(false); setDisarmPassword(''); setError(null); }}
                    className="rounded-md border border-brand-clay px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-brand-ink/60 transition-colors hover:bg-brand-paper"
                  >
                    {t('two_factor.cancel')}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
