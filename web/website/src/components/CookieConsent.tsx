import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getStoredConsent, setConsent } from '@/lib/consent';
import { initGA } from '@/lib/analytics';

/**
 * Asks before any analytics runs. Strictly necessary cookies (sign-in session,
 * guest cart) are not covered by this choice - the site cannot work without
 * them - and the copy says so rather than implying everything is optional.
 */
export function CookieConsent() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only ask visitors who have not answered yet.
    if (getStoredConsent() === null) setVisible(true);
  }, []);

  const choose = (choice: 'granted' | 'denied') => {
    setConsent(choice);
    setVisible(false);
    // Start analytics immediately on accept rather than making them reload.
    if (choice === 'granted') initGA();
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t('cookies.title')}
      className="fixed inset-x-0 bottom-0 z-[60] p-4 md:p-6"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-sm border border-outline-variant bg-surface-container-lowest p-5 shadow-2xl md:flex-row md:items-center md:gap-6 md:p-6">
        <div className="flex-1">
          <p className="font-bold mb-1">{t('cookies.title')}</p>
          <p className="body-sm text-secondary">
            {t('cookies.body')}{' '}
            <Link to="/chinh-sach-bao-mat" className="text-primary hover:underline">
              {t('footer.privacy')}
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <button
            onClick={() => choose('denied')}
            className="flex-1 rounded-sm border border-outline-variant px-5 py-3 label-sm font-bold transition-colors hover:bg-surface-container md:flex-none"
          >
            {t('cookies.decline')}
          </button>
          <button
            onClick={() => choose('granted')}
            className="flex-1 rounded-sm bg-primary px-5 py-3 label-sm font-bold text-on-primary transition-opacity hover:opacity-90 md:flex-none"
          >
            {t('cookies.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
