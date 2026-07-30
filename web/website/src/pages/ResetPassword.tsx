import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CircleAlert, KeyRound, Loader2 } from 'lucide-react';
import { Logo } from '@izuna/shared/components/Logo';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';


type ResetState = 'form' | 'success' | 'invalid';


export function ResetPasswordPage() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const [searchParams] = useSearchParams();
  const uid = searchParams.get('uid') || '';
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [state, setState] = useState<ResetState>(uid && token ? 'form' : 'invalid');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwords_not_match'));
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch('/password-reset/confirm/', {
        method: 'POST',
        body: JSON.stringify({
          uid,
          token,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        await logout().catch(() => undefined);
        setState('success');
      } else if (data.code === 'password_reset_invalid') {
        setState('invalid');
      } else {
        const passwordError = data.new_password?.[0] || data.confirm_password?.[0];
        setError(passwordError || data.detail || t('auth.password_reset_failed'));
      }
    } catch {
      setError(t('common.error_connection'));
    } finally {
      setLoading(false);
    }
  };

  const isSuccess = state === 'success';
  const isInvalid = state === 'invalid';

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-[520px] bg-white border border-surface-variant rounded-sm p-8 md:p-12 text-center">
        <div className="flex justify-center mb-10">
          <Logo size="lg" forceBlack />
        </div>

        <div className="flex justify-center mb-6">
          {isInvalid ? (
            <CircleAlert className="text-amber-600" size={48} aria-hidden="true" />
          ) : (
            <KeyRound className="text-primary" size={48} aria-hidden="true" />
          )}
        </div>

        <h1 className="headline-lg mb-3">
          {isSuccess
            ? t('auth.reset_success_title')
            : isInvalid
              ? t('auth.reset_invalid_title')
              : t('auth.reset_password_title')}
        </h1>
        <p className="body-md text-secondary mb-8">
          {isSuccess
            ? t('auth.reset_success_body')
            : isInvalid
              ? t('auth.reset_invalid_body')
              : t('auth.reset_password_body')}
        </p>

        {error && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-600 body-sm rounded-sm" role="alert">
            {error}
          </div>
        )}

        {state === 'form' && (
          <form className="space-y-4 text-left" onSubmit={handleSubmit}>
            <div>
              <label className="label-sm text-secondary block mb-2" htmlFor="new-password">
                {t('auth.new_password')}
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full bg-white border border-surface-variant rounded-sm px-4 py-3 body-md text-on-surface outline-none focus:border-primary transition-all"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
            </div>
            <div>
              <label className="label-sm text-secondary block mb-2" htmlFor="confirm-new-password">
                {t('auth.confirm_password')}
              </label>
              <input
                id="confirm-new-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full bg-white border border-surface-variant rounded-sm px-4 py-3 body-md text-on-surface outline-none focus:border-primary transition-all"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
            </div>
            <p className="body-sm text-secondary">{t('auth.password_requirements')}</p>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-container text-white py-4 rounded-sm hover:bg-primary transition-all flex items-center justify-center gap-3 label-md disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              <span>{loading ? t('auth.resetting_password') : t('auth.reset_password_button')}</span>
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

        {isInvalid && (
          <Link
            to="/forgot-password"
            className="w-full bg-primary-container text-white py-4 rounded-sm hover:bg-primary transition-all flex items-center justify-center gap-3 label-md"
          >
            <span>{t('auth.request_new_reset_link')}</span>
            <ArrowRight size={18} />
          </Link>
        )}
      </div>
    </div>
  );
}
