import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icons } from '@/components/Icons';
import { Logo } from '@/components/Logo';
import { ArrowRight, Check } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState(localStorage.getItem('remembered_email') || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem('remembered_email'));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiFetch('/login/', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store tokens
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);

        // Handle Remember Me
        if (rememberMe) {
          localStorage.setItem('remembered_email', email);
        } else {
          localStorage.removeItem('remembered_email');
        }

        // Navigate to home
        navigate('/');
      } else {
        setError(data.detail || t('auth.invalid_credentials'));
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
          <div className="mb-12 text-center md:text-left flex flex-col items-center md:items-start gap-8">
            <Logo size="lg" />
            <div>
              <h2 className="headline-lg mb-2">{t('auth.access_collection')}</h2>
              <p className="body-md text-secondary">Welcome back to the artisan collection.</p>
            </div>
          </div>
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 body-sm rounded-sm">
                {error}
              </div>
            )}
            <div className="flex flex-col gap-2">
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
            </div>
            <div className="flex flex-col gap-2">
              <label className="label-sm text-secondary" htmlFor="password">{t('auth.password')}</label>
              <input 
                id="password"
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-surface-variant rounded-sm px-4 py-3 body-md text-on-surface outline-none focus:border-primary transition-all"
                placeholder={t('auth.enter_password')}
                required
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="peer appearance-none w-4 h-4 border border-surface-variant rounded-sm checked:bg-primary checked:border-primary transition-all"
                  />
                  <Check size={12} className="absolute text-white scale-0 peer-checked:scale-100 transition-transform" />
                </div>
                <span className="body-sm text-secondary group-hover:text-primary transition-colors">{t('auth.remember_me')}</span>
              </label>
              <button type="button" className="label-sm text-secondary hover:text-primary transition-colors">
                {t('auth.forgot_password')}
              </button>
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-primary-container text-white py-4 rounded-sm hover:bg-primary transition-all flex items-center justify-center gap-3 label-md disabled:opacity-50"
            >
              <span>{loading ? t('auth.signing_in') : t('auth.sign_in')}</span>
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
          <div className="mt-12 flex flex-col items-center md:items-start space-y-6">
            <div className="w-full h-px bg-surface-variant" />
            <div className="text-center md:text-left w-full pt-4">
              <span className="body-md text-secondary">{t('auth.new_to_kogei')}</span>
              <Link to="/register" className="ml-2 label-sm text-on-surface hover:text-primary transition-colors border-b border-on-surface hover:border-primary pb-1">
                {t('auth.create_account')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
