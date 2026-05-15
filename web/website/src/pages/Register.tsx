import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icons } from '@/components/Icons';
import { Logo } from '@/components/Logo';
import { ArrowRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export function RegisterPage() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (password !== confirmPassword) {
      setError(t('auth.passwords_not_match'));
      return;
    }

    setLoading(true);

    try {
      const response = await apiFetch('/register/', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        navigate('/login');
      } else {
        // Handle field-specific errors from Django
        if (data && typeof data === 'object') {
          setFieldErrors(data);
          // Also set a general error if no specific fields are caught
          if (!data.username && !data.email && !data.password) {
            setError(data.detail || t('auth.registration_failed'));
          }
        } else {
          setError(t('auth.registration_failed'));
        }
      }
    } catch (err) {
      setError(t('common.error_connection'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-surface">
      <div className="hidden md:block w-full md:w-1/2 relative min-h-screen">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAYx4N_KGp9PaB1iF6i4DricApqoGzv8pp66cyyyczyePv66qo2crpj6RqBD7NFRAsd9ZT5I0Y4YFd-7IRfSnYPDuteNnLOCbSY7nwSgxmatbDqGuMRis_3AoE_6j9Vt-ekse4rbttScetenX78DcQeMHEq4SnxUyZX_yhrfcknlDjeG1-Ud1hCgagjtc2C3bfeQ1IGneeMTyiRmJs2wfAy4kvxOnlUSMxc9xjjjNwTMWlE1UvrW7xnGcSroSCYKS7iFk0J8o7eVJk')" }}
        />
        <div className="absolute inset-0 bg-black/10" />
      </div>
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 min-h-screen">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 text-center md:text-left flex flex-col items-center md:items-start gap-8">
            <Logo size="lg" forceBlack />
            <div>
              <h2 className="headline-lg mb-2">{t('auth.community_join')}</h2>
              <p className="body-md text-secondary">Begin your journey into artisan excellence.</p>
            </div>
          </div>
          <form className="space-y-4" onSubmit={handleRegister}>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 body-sm rounded-sm">
                {error}
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="label-sm text-secondary" htmlFor="username">{t('auth.username')}</label>
              <input 
                id="username"
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white border border-surface-variant rounded-sm px-4 py-3 body-md text-on-surface outline-none focus:border-primary transition-all"
                placeholder={t('auth.choose_username')}
                required
              />
              {fieldErrors.username && (
                <span className="text-red-500 text-xs mt-1">{fieldErrors.username[0]}</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-sm text-secondary" htmlFor="email">{t('auth.email')}</label>
              <input 
                id="email"
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-surface-variant rounded-sm px-4 py-3 body-md text-on-surface outline-none focus:border-primary transition-all"
                placeholder={t('auth.enter_email')}
                required
              />
              {fieldErrors.email && (
                <span className="text-red-500 text-xs mt-1">{fieldErrors.email[0]}</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-sm text-secondary" htmlFor="password">{t('auth.password')}</label>
              <input 
                id="password"
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-surface-variant rounded-sm px-4 py-3 body-md text-on-surface outline-none focus:border-primary transition-all"
                placeholder={t('auth.create_password')}
                required
              />
              {fieldErrors.password && (
                <span className="text-red-500 text-xs mt-1">{fieldErrors.password[0]}</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-sm text-secondary" htmlFor="confirmPassword">{t('auth.confirm_password')}</label>
              <input 
                id="confirmPassword"
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white border border-surface-variant rounded-sm px-4 py-3 body-md text-on-surface outline-none focus:border-primary transition-all"
                placeholder={t('auth.confirm_password_placeholder')}
                required
              />
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-primary-container text-white py-4 rounded-sm hover:bg-primary transition-all flex items-center justify-center gap-3 label-md disabled:opacity-50 mt-4"
            >
              <span>{loading ? t('auth.creating_account') : t('auth.create_account')}</span>
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
          <div className="mt-8 pt-4 border-t border-surface-variant">
            <div className="text-center md:text-left w-full">
              <span className="body-md text-secondary">{t('auth.already_have_account')}</span>
              <Link to="/login" className="ml-2 label-sm text-on-surface hover:text-primary transition-colors border-b border-on-surface hover:border-primary pb-1">
                {t('auth.sign_in')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
