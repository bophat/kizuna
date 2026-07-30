import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CircleAlert, Loader2, MailCheck } from 'lucide-react';
import { Logo } from '@izuna/shared/components/Logo';
import { apiFetch } from '@/lib/api';

type VerificationState = 'idle' | 'verifying' | 'success' | 'expired' | 'invalid' | 'sent';

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [state, setState] = useState<VerificationState>(
    token ? 'verifying' : searchParams.get('sent') === '1' ? 'sent' : 'idle',
  );
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const verificationStarted = useRef(false);

  useEffect(() => {
    if (!token || verificationStarted.current) return;
    verificationStarted.current = true;

    apiFetch('/verify-email/', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          setState('success');
          return;
        }
        setState(data.code === 'verification_expired' ? 'expired' : 'invalid');
      })
      .catch(() => {
        setState('invalid');
        setError(t('common.error_connection'));
      });
  }, [t, token]);

  const resendVerification = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setResending(true);

    try {
      const response = await apiFetch('/resend-verification/', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          data.code === 'verification_delivery_failed'
            ? t('auth.verification_resend_failed')
            : data.detail || t('auth.verification_resend_failed'),
        );
      } else {
        setState('sent');
      }
    } catch {
      setError(t('common.error_connection'));
    } finally {
      setResending(false);
    }
  };

  const isVerifying = state === 'verifying';
  const isSuccess = state === 'success';
  const showResend = !isVerifying && !isSuccess;

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-[520px] bg-white border border-surface-variant rounded-sm p-8 md:p-12 text-center">
        <div className="flex justify-center mb-10">
          <Logo size="lg" forceBlack />
        </div>

        <div className="flex justify-center mb-6">
          {isVerifying ? (
            <Loader2 className="animate-spin text-primary" size={48} aria-hidden="true" />
          ) : state === 'invalid' || state === 'expired' ? (
            <CircleAlert className="text-amber-600" size={48} aria-hidden="true" />
          ) : (
            <MailCheck className="text-primary" size={48} aria-hidden="true" />
          )}
        </div>

        <h1 className="headline-lg mb-3">
          {isVerifying
            ? t('auth.verification_checking_title')
            : isSuccess
              ? t('auth.verification_success_title')
              : state === 'expired'
                ? t('auth.verification_expired_title')
                : state === 'invalid'
                  ? t('auth.verification_invalid_title')
                  : t('auth.verification_sent_title')}
        </h1>
        <p className="body-md text-secondary mb-8">
          {isVerifying
            ? t('auth.verification_checking_body')
            : isSuccess
              ? t('auth.verification_success_body')
              : state === 'expired'
                ? t('auth.verification_expired_body')
                : state === 'invalid'
                  ? t('auth.verification_invalid_body')
                  : t('auth.verification_sent_body')}
        </p>

        {error && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-600 body-sm rounded-sm" role="alert">
            {error}
          </div>
        )}

        {showResend && (
          <form className="space-y-4 text-left" onSubmit={resendVerification}>
            <label className="label-sm text-secondary block" htmlFor="verification-email">
              {t('auth.email')}
            </label>
            <input
              id="verification-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full bg-white border border-surface-variant rounded-sm px-4 py-3 body-md text-on-surface outline-none focus:border-primary transition-all"
              placeholder={t('auth.enter_email')}
              required
            />
            <button
              type="submit"
              disabled={resending}
              className="w-full bg-primary-container text-white py-4 rounded-sm hover:bg-primary transition-all flex items-center justify-center gap-3 label-md disabled:opacity-50"
            >
              <span>{resending ? t('auth.verification_resending') : t('auth.verification_resend')}</span>
              {!resending && <ArrowRight size={18} />}
            </button>
          </form>
        )}

        {isSuccess && (
          <Link
            to="/login"
            className="w-full bg-primary-container text-white py-4 rounded-sm hover:bg-primary transition-all flex items-center justify-center gap-3 label-md"
          >
            <span>{t('auth.continue_to_login')}</span>
            <ArrowRight size={18} />
          </Link>
        )}

        {!isVerifying && !isSuccess && (
          <p className="body-sm text-secondary mt-6">
            <Link to="/login" className="text-on-surface border-b border-on-surface hover:text-primary hover:border-primary">
              {t('auth.back_to_login')}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
