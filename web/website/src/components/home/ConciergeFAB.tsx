import { Link } from 'react-router-dom';
import { Icons } from '../Icons';
import { useTranslation } from 'react-i18next';

export function ConciergeFAB() {
  const { t } = useTranslation();

  return (
    <div className="fixed bottom-20 md:bottom-8 right-6 md:right-8 z-[60]">
      <Link
        to="/concierge"
        className="bg-inverse-surface text-inverse-on-surface flex items-center gap-3 px-6 py-3 md:px-8 md:py-4 rounded-full shadow-2xl hover:shadow-primary/20 hover:-translate-y-1 transition-all group border border-inverse-surface"
      >
        <Icons.Sparkles size={20} className="text-primary animate-pulse" />
        <span className="label-sm md:label-md tracking-normal normal-case font-bold">
          {t('concierge.ask_kenji')}
        </span>
      </Link>
    </div>
  );
}
