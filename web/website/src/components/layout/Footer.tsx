import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Logo } from '../Logo';

export function Footer() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-stone-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 mt-auto">
      <div className="max-w-[1280px] mx-auto py-16 px-8 flex flex-col md:flex-row justify-between items-center gap-12">
        <Link to="/" className="flex items-center group">
          <Logo className="transition-transform group-hover:scale-105" />
        </Link>
        <div className="flex flex-wrap justify-center gap-8">
          {[
            { key: 'privacy', label: t('footer.privacy') },
            { key: 'terms', label: t('footer.terms') },
            { key: 'shipping', label: t('footer.shipping') },
            { key: 'contact', label: t('footer.contact') }
          ].map((item) => (
            <Link
              key={item.key}
              to="#"
              className="label-sm text-zinc-500 hover:text-primary transition-colors lowercase tracking-wider border-b border-transparent hover:border-primary pb-1"
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="label-sm text-zinc-400 normal-case tracking-normal">
          {t('footer.rights', { year: currentYear })}
        </div>
      </div>
    </footer>
  );
}
