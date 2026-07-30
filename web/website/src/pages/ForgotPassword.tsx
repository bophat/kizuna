import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Loader2, MailCheck } from 'lucide-react';
import { Logo } from '@izuna/shared/components/Logo';
import { apiFetch } from '@/lib/api';


export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiFetch('/password-reset/request/', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setSent(true);
      } else {
        setError(data.detail || t('auth.password_reset_failed'));
      }
    } catch {
      setError(t('common.error_connection'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-[520px] bg-white border border-surface-variant rounded-sm p-8 md:p-12 text-center">
        <div className="flex justify-center mb-10">
          <Logo size="lg" forceBlack />
        </div>

        <div className="flex justify-center mb-6">
          <MailCheck className="text-primary" size={48} aria-hidden="true" />
        </div>

        <h1 className="headline-lg mb-3">
          {sent ? t('auth.password_reset_sent_title') : t('auth.forgot_title')}
        </h1>
        <p className="body-md text-secondary mb-8">
          {sent ? t('auth.password_reset_sent_body') : t('auth.forgot_body')}
        </p>

        {error && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-600 body-sm rounded-sm" role="alert">
            {error}
          </div>
        )}

        {!sent && (
          <form className="space-y-4 text-left" onSubmit={handleSubmit}>
            <label className="label-sm text-secondary block" htmlFor="password-reset-email">
              {t('auth.email')}
            </label>
            <input
              id="password-reset-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full bg-white border border-surface-variant rounded-sm px-4 py-3 body-md text-on-surface outline-none focus:border-primary transition-all"
              placeholder={t('auth.enter_email')}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-container text-white py-4 rounded-sm hover:bg-primary transition-all flex items-center justify-center gap-3 label-md disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              <span>{loading ? t('auth.sending_reset_link') : t('auth.send_reset_link')}</span>
            </button>
          </form>
        )}

        <p className="body-sm text-secondary mt-6">
          <Link to="/login" className="text-on-surface border-b border-on-surface hover:text-primary hover:border-primary">
            {t('auth.back_to_login')}
          </Link>
        </p>
      </div>
    </div>
  );
}
