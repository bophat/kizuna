import { useEffect, useState } from 'react';
import { FileQuestion, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ContentRenderer } from '@izuna/shared/components/ContentRenderer';
import { apiFetch } from '@/lib/api';
import { SEO } from '@/components/SEO';

/** slug (dùng nội bộ để gọi API) → route thật (dùng cho canonical/og:url) */
const STATIC_PAGE_PATHS: Record<string, string> = {
  'privacy-policy': '/chinh-sach-bao-mat',
  'terms-of-service': '/dieu-khoan-dich-vu',
  'shipping-returns': '/giao-hang-va-tra-hang',
};

const stripToExcerpt = (content: string, max = 160) =>
  content
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#*_>`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

interface StorePage {
  slug: string;
  title: string;
  content: string;
  content_type: 'markdown' | 'html';
  updated_at: string;
}

export function useStorePage(slug: string) {
  const [page, setPage] = useState<StorePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    setError(false);
    apiFetch(`/pages/${slug}/`)
      .then(async (response) => {
        if (!active) return;
        if (response.status === 404) {
          setNotFound(true);
          return;
        }
        if (!response.ok) throw new Error('Unable to load page');
        setPage(await response.json());
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [slug]);

  return { page, loading, notFound, error };
}

function PageUnavailable({ error }: { error: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-[65vh] flex flex-col items-center justify-center px-6 text-center">
      <SEO title={t('seo.not_found_title')} noindex />
      <FileQuestion className="mb-5 h-12 w-12 text-primary/40" />
      <h1 className="mb-3 font-serif text-3xl text-on-surface">
        {error ? t('static_pages.load_error') : t('static_pages.not_found')}
      </h1>
      <p className="mb-8 max-w-lg text-secondary">{t('static_pages.not_found_description')}</p>
      <Link to="/" className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90">
        {t('static_pages.back_home')}
      </Link>
    </div>
  );
}

export function StaticPage({ slug }: { slug: string }) {
  const { t, i18n } = useTranslation();
  const { page, loading, notFound, error } = useStorePage(slug);

  if (loading) {
    return (
      <div className="min-h-[65vh] flex items-center justify-center" role="status">
        <Loader2 className="h-9 w-9 animate-spin text-primary" />
        <span className="sr-only">{t('common.loading')}</span>
      </div>
    );
  }
  if (notFound || error || !page) return <PageUnavailable error={error} />;

  const updatedAt = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(new Date(page.updated_at));
  return (
    <main className="min-h-[65vh] bg-surface-container-low/50 px-5 py-14 md:py-20">
      <SEO
        title={page.title}
        description={stripToExcerpt(page.content)}
        path={STATIC_PAGE_PATHS[slug]}
      />
      <article className="mx-auto max-w-4xl rounded-2xl border border-outline-variant bg-surface-container-lowest px-6 py-10 shadow-sm md:px-14 md:py-14">
        <div className="mb-10 border-b border-outline-variant pb-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-primary">KIZUNA</p>
          <h1 className="font-serif text-4xl font-semibold text-on-surface md:text-5xl">{page.title}</h1>
          <p className="mt-4 text-sm text-secondary">{t('static_pages.updated_at', { date: updatedAt })}</p>
        </div>
        <ContentRenderer content={page.content} contentType={page.content_type} />
      </article>
    </main>
  );
}
