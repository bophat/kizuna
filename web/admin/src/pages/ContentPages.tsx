import { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, Eye, EyeOff, FileText, Inbox, Loader2, Mail, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ContentRenderer } from '@izuna/shared/components/ContentRenderer';
import { toast } from '@izuna/shared/lib/toast';
import { apiFetch } from '../lib/api';

interface StorePage {
  id: number;
  slug: string;
  title: string;
  content: string;
  content_type: 'markdown' | 'html';
  is_published: boolean;
  updated_by_name: string;
  updated_at: string;
}

interface ContactInfo {
  phone: string;
  email: string;
  address: string;
  working_hours: string;
  facebook_url: string;
  zalo_url: string;
  instagram_url: string;
  tiktok_url: string;
  updated_at?: string;
}

interface ContactMessage {
  id: number;
  name: string;
  email: string;
  message: string;
  status: 'unread' | 'read' | 'replied';
  created_at: string;
}

const emptyContact: ContactInfo = {
  phone: '', email: '', address: '', working_hours: '', facebook_url: '', zalo_url: '',
  instagram_url: '', tiktok_url: '',
};

export default function ContentPages() {
  const { t, i18n } = useTranslation();
  const [pages, setPages] = useState<StorePage[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('privacy-policy');
  const [draft, setDraft] = useState<StorePage | null>(null);
  const [contact, setContact] = useState<ContactInfo>(emptyContact);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPage, setSavingPage] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const selectedPage = useMemo(
    () => pages.find((page) => page.slug === selectedSlug) || pages[0],
    [pages, selectedSlug],
  );

  const load = async () => {
    setLoading(true);
    try {
      const [pagesResponse, contactResponse, messagesResponse] = await Promise.all([
        apiFetch('/pages/'),
        apiFetch('/contact-info/'),
        apiFetch('/contact-messages/'),
      ]);
      if (!pagesResponse.ok || !contactResponse.ok || !messagesResponse.ok) throw new Error('load failed');
      const [pagesData, contactData, messagesData] = await Promise.all([
        pagesResponse.json(), contactResponse.json(), messagesResponse.json(),
      ]);
      setPages(pagesData);
      setContact(contactData);
      setMessages(messagesData);
    } catch {
      toast.error(t('content_pages.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (selectedPage) setDraft({ ...selectedPage });
  }, [selectedPage]);

  const savePage = async () => {
    if (!draft) return;
    setSavingPage(true);
    try {
      const response = await apiFetch(`/pages/${draft.slug}/`, {
        method: 'PUT',
        body: JSON.stringify({
          title: draft.title,
          content: draft.content,
          content_type: draft.content_type,
          is_published: draft.is_published,
        }),
      });
      if (!response.ok) throw new Error('save failed');
      const saved: StorePage = await response.json();
      setPages((current) => current.map((page) => page.slug === saved.slug ? saved : page));
      setDraft(saved);
      toast.success(t('content_pages.saved'));
    } catch {
      toast.error(t('content_pages.save_failed'));
    } finally {
      setSavingPage(false);
    }
  };

  const saveContact = async () => {
    setSavingContact(true);
    try {
      const response = await apiFetch('/contact-info/', {
        method: 'PUT',
        body: JSON.stringify(contact),
      });
      if (!response.ok) throw new Error('save failed');
      setContact(await response.json());
      toast.success(t('content_pages.contact_saved'));
    } catch {
      toast.error(t('content_pages.save_failed'));
    } finally {
      setSavingContact(false);
    }
  };

  const updateMessageStatus = async (message: ContactMessage, status: ContactMessage['status']) => {
    const response = await apiFetch(`/contact-messages/${message.id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      toast.error(t('content_pages.save_failed'));
      return;
    }
    const updated = await response.json();
    setMessages((current) => current.map((item) => item.id === updated.id ? updated : item));
  };

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-brand-red" /></div>;
  }

  return (
    <div className="ma-spacing space-y-8">
      <header>
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-brand-red">CMS</p>
        <h1 className="text-4xl font-serif font-bold">{t('content_pages.title')}</h1>
        <p className="mt-2 max-w-3xl text-sm text-brand-ink/50">{t('content_pages.description')}</p>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-xl border border-brand-clay bg-white shadow-sm">
          <div className="border-b border-brand-clay px-5 py-4 text-sm font-semibold">{t('content_pages.page_list')}</div>
          {pages.map((page) => (
            <button key={page.slug} onClick={() => setSelectedSlug(page.slug)} className={`flex w-full items-start gap-3 border-b border-brand-clay/70 px-5 py-4 text-left transition-colors last:border-0 ${selectedSlug === page.slug ? 'bg-brand-red/5 text-brand-red' : 'hover:bg-brand-paper'}`}>
              <FileText size={18} className="mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{page.title}</span><span className="mt-1 block text-xs text-brand-ink/35">/{page.slug}</span></span>
              {page.is_published ? <Eye size={15} className="mt-0.5 text-emerald-600" /> : <EyeOff size={15} className="mt-0.5 text-brand-ink/30" />}
            </button>
          ))}
        </aside>

        {draft && (
          <section className="overflow-hidden rounded-xl border border-brand-clay bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-brand-clay px-6 py-5 md:flex-row md:items-center md:justify-between">
              <div><h2 className="font-serif text-2xl font-semibold">{draft.title}</h2><p className="mt-1 text-xs text-brand-ink/40">{t('content_pages.last_updated', { date: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(draft.updated_at)) })}{draft.updated_by_name ? ` · ${draft.updated_by_name}` : ''}</p></div>
              <button onClick={savePage} disabled={savingPage || !draft.title.trim()} className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-red disabled:opacity-50">
                {savingPage ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}{t('common.save')}
              </button>
            </div>
            <div className="space-y-6 p-6">
              <label className="block text-sm font-semibold">{t('content_pages.fields.title')}<input maxLength={255} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="mt-2 w-full rounded-md border border-brand-clay bg-brand-paper/30 px-4 py-3 outline-none focus:border-brand-red" /></label>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block text-sm font-semibold">{t('content_pages.fields.content_type')}<select value={draft.content_type} onChange={(e) => setDraft({ ...draft, content_type: e.target.value as StorePage['content_type'] })} className="mt-2 w-full rounded-md border border-brand-clay bg-white px-4 py-3 outline-none focus:border-brand-red"><option value="markdown">Markdown</option><option value="html">HTML</option></select></label>
                <label className="mt-7 flex cursor-pointer items-center gap-3 rounded-md border border-brand-clay px-4 py-3"><input type="checkbox" checked={draft.is_published} onChange={(e) => setDraft({ ...draft, is_published: e.target.checked })} className="h-4 w-4 accent-brand-red" /><span className="text-sm font-semibold">{t('content_pages.fields.published')}</span>{draft.is_published && <Check size={16} className="ml-auto text-emerald-600" />}</label>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between"><label className="text-sm font-semibold">{t('content_pages.fields.content')}</label><button onClick={() => setShowPreview((value) => !value)} className="inline-flex items-center gap-2 text-xs font-semibold text-brand-red">{showPreview ? <EyeOff size={15} /> : <Eye size={15} />}{showPreview ? t('content_pages.hide_preview') : t('content_pages.show_preview')}</button></div>
                <div className={`grid gap-5 ${showPreview ? 'lg:grid-cols-2' : ''}`}>
                  <textarea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} rows={20} maxLength={100000} className="min-h-[480px] w-full resize-y rounded-md border border-brand-clay bg-brand-paper/20 p-4 font-mono text-sm leading-6 outline-none focus:border-brand-red" />
                  {showPreview && <div className="min-h-[480px] overflow-auto rounded-md border border-brand-clay p-6"><p className="mb-5 border-b border-brand-clay pb-3 text-xs font-bold uppercase tracking-widest text-brand-ink/35">{t('content_pages.preview')}</p><ContentRenderer content={draft.content} contentType={draft.content_type} /></div>}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {selectedSlug === 'contact' && (
        <>
          <section className="rounded-xl border border-brand-clay bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between"><div><h2 className="font-serif text-2xl font-semibold">{t('content_pages.contact_title')}</h2><p className="mt-1 text-sm text-brand-ink/45">{t('content_pages.contact_description')}</p></div><button onClick={saveContact} disabled={savingContact} className="inline-flex items-center gap-2 rounded-md bg-brand-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-red disabled:opacity-50">{savingContact ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}{t('common.save')}</button></div>
            <div className="grid gap-5 md:grid-cols-2">
              {(['phone', 'email', 'working_hours', 'facebook_url', 'zalo_url', 'instagram_url', 'tiktok_url'] as const).map((field) => <label key={field} className="text-sm font-semibold">{t(`content_pages.contact_fields.${field}`)}<input type={field === 'email' ? 'email' : field.endsWith('_url') ? 'url' : 'text'} value={contact[field]} onChange={(e) => setContact({ ...contact, [field]: e.target.value })} className="mt-2 w-full rounded-md border border-brand-clay px-4 py-3 outline-none focus:border-brand-red" /></label>)}
              <label className="text-sm font-semibold md:col-span-2">{t('content_pages.contact_fields.address')}<textarea rows={3} value={contact.address} onChange={(e) => setContact({ ...contact, address: e.target.value })} className="mt-2 w-full rounded-md border border-brand-clay px-4 py-3 outline-none focus:border-brand-red" /></label>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-brand-clay bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-brand-clay px-6 py-5"><Inbox className="text-brand-red" /><div><h2 className="font-serif text-2xl font-semibold">{t('content_pages.messages_title')}</h2><p className="text-sm text-brand-ink/45">{t('content_pages.messages_count', { count: messages.length })}</p></div></div>
            {messages.length === 0 ? <p className="p-8 text-center text-sm text-brand-ink/40">{t('content_pages.no_messages')}</p> : <div className="divide-y divide-brand-clay">{messages.map((message) => (
              <article key={message.id} className={`p-6 ${message.status === 'unread' ? 'bg-brand-red/[0.025]' : ''}`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{message.name}</h3>{message.status === 'unread' && <span className="rounded-full bg-brand-red px-2 py-0.5 text-[10px] font-bold uppercase text-white">{t('content_pages.unread')}</span>}</div><a href={`mailto:${message.email}`} className="mt-1 inline-flex items-center gap-1 text-sm text-brand-red hover:underline"><Mail size={14} />{message.email}</a><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-brand-ink/70">{message.message}</p><p className="mt-3 inline-flex items-center gap-1 text-xs text-brand-ink/35"><Clock3 size={13} />{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(message.created_at))}</p></div><select value={message.status} onChange={(e) => void updateMessageStatus(message, e.target.value as ContactMessage['status'])} className="rounded-md border border-brand-clay bg-white px-3 py-2 text-xs font-semibold"><option value="unread">{t('content_pages.status.unread')}</option><option value="read">{t('content_pages.status.read')}</option><option value="replied">{t('content_pages.status.replied')}</option></select></div>
              </article>
            ))}</div>}
          </section>
        </>
      )}
    </div>
  );
}
