import { type FormEvent, useEffect, useState } from 'react';
import { Clock3, Facebook, Instagram, Loader2, Mail, MapPin, MessageCircle, Music2, Phone, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ContentRenderer } from '@izuna/shared/components/ContentRenderer';
import { apiFetch } from '@/lib/api';
import { SEO } from '@/components/SEO';
import { useStorePage } from './StaticPage';

interface ContactInfo {
  phone: string;
  email: string;
  address: string;
  working_hours: string;
  facebook_url: string;
  zalo_url: string;
  instagram_url: string;
  tiktok_url: string;
}

const emptyContactInfo: ContactInfo = {
  phone: '', email: '', address: '', working_hours: '', facebook_url: '', zalo_url: '',
  instagram_url: '', tiktok_url: '',
};

export function ContactPage() {
  const { t } = useTranslation();
  const { page, loading: pageLoading } = useStorePage('contact');
  const [info, setInfo] = useState<ContactInfo>(emptyContactInfo);
  const [infoLoading, setInfoLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch('/contact-info/')
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load contact information');
        if (active) setInfo(await response.json());
      })
      .catch(() => undefined)
      .finally(() => { if (active) setInfoLoading(false); });
    return () => { active = false; };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError('');
    setSuccess(false);
    try {
      const response = await apiFetch('/contact/submit/', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error('Unable to send message');
      setForm({ name: '', email: '', message: '' });
      setSuccess(true);
    } catch {
      setError(t('contact.form_error'));
    } finally {
      setSending(false);
    }
  };

  const details = [
    info.phone && { icon: Phone, label: t('contact.phone'), value: info.phone, href: `tel:${info.phone}` },
    info.email && { icon: Mail, label: t('contact.email'), value: info.email, href: `mailto:${info.email}` },
    info.address && { icon: MapPin, label: t('contact.address'), value: info.address },
    info.working_hours && { icon: Clock3, label: t('contact.working_hours'), value: info.working_hours },
  ].filter(Boolean) as Array<{ icon: typeof Phone; label: string; value: string; href?: string }>;

  if (pageLoading || infoLoading) {
    return <div className="min-h-[65vh] flex items-center justify-center"><Loader2 className="h-9 w-9 animate-spin text-primary" /></div>;
  }

  return (
    <main className="min-h-[65vh] bg-surface-container-low/50 px-5 py-14 md:py-20">
      <SEO title={t('seo.contact_title')} description={t('seo.contact_description')} path="/lien-he" />
      <div className="mx-auto max-w-6xl">
        <header className="mb-12 max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-primary">KIZUNA</p>
          <h1 className="font-serif text-4xl font-semibold text-on-surface md:text-5xl">{page?.title || t('contact.title')}</h1>
          {page && <ContentRenderer content={page.content} contentType={page.content_type} className="mt-6" />}
        </header>

        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-2xl bg-primary p-7 text-white md:p-10">
            <h2 className="mb-2 font-serif text-3xl">{t('contact.information')}</h2>
            <p className="mb-8 text-sm leading-6 text-white/70">{t('contact.information_description')}</p>
            <div className="space-y-6">
              {details.length ? details.map(({ icon: Icon, label, value, href }) => (
                <div key={label} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10"><Icon size={19} /></span>
                  <div><p className="text-xs uppercase tracking-wider text-white/55">{label}</p>{href ? <a href={href} className="mt-1 block break-words hover:underline">{value}</a> : <p className="mt-1 whitespace-pre-line">{value}</p>}</div>
                </div>
              )) : <p className="text-white/70">{t('contact.information_updating')}</p>}
            </div>
            {(info.facebook_url || info.zalo_url || info.instagram_url || info.tiktok_url) && (
              <div className="mt-9 flex gap-3 border-t border-white/15 pt-7">
                {info.facebook_url && <a href={info.facebook_url} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="rounded-full bg-white/10 p-3 hover:bg-white/20"><Facebook size={19} /></a>}
                {info.zalo_url && <a href={info.zalo_url} target="_blank" rel="noopener noreferrer" aria-label="Zalo" className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-3 text-xs font-semibold hover:bg-white/20"><MessageCircle size={18} /> Zalo</a>}
                {info.instagram_url && <a href={info.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="rounded-full bg-white/10 p-3 hover:bg-white/20"><Instagram size={19} /></a>}
                {info.tiktok_url && <a href={info.tiktok_url} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-3 text-xs font-semibold hover:bg-white/20"><Music2 size={18} /> TikTok</a>}
              </div>
            )}
          </section>

          <form onSubmit={submit} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-7 shadow-sm md:p-10">
            <h2 className="mb-2 font-serif text-3xl text-on-surface">{t('contact.form_title')}</h2>
            <p className="mb-7 text-sm text-secondary">{t('contact.form_description')}</p>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="text-sm font-medium text-on-surface-variant">{t('contact.name')}<input required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-2 w-full rounded-lg border border-outline-variant bg-transparent px-4 py-3 outline-none focus:border-primary" /></label>
              <label className="text-sm font-medium text-on-surface-variant">{t('contact.email')}<input required type="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-2 w-full rounded-lg border border-outline-variant bg-transparent px-4 py-3 outline-none focus:border-primary" /></label>
            </div>
            <label className="mt-5 block text-sm font-medium text-on-surface-variant">{t('contact.message')}<textarea required maxLength={5000} rows={7} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="mt-2 w-full resize-y rounded-lg border border-outline-variant bg-transparent px-4 py-3 outline-none focus:border-primary" /></label>
            {success && <p className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">{t('contact.form_success')}</p>}
            {error && <p className="mt-5 rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container" role="alert">{error}</p>}
            <button disabled={sending} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60">
              {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}{sending ? t('contact.sending') : t('contact.send')}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
