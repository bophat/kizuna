import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fadeUp, tweenFast } from '@/lib/motion';
import { Icons } from '@/components/Icons';
import { SEO } from '@/components/SEO';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

interface CustomerNotification {
  id: number;
  kind: 'order' | 'payment' | 'promo' | 'cart' | 'system';
  title: string;
  message: string;
  link: string;
  action_label: string;
  is_read: boolean;
  created_at: string;
}

const KIND_ICON = {
  order: Icons.Package,
  payment: Icons.Banknote,
  promo: Icons.TicketPercent,
  cart: Icons.ShoppingBag,
  system: Icons.Bell,
} as const;

export function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [items, setItems] = useState<CustomerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      const res = await apiFetch('/shop/notifications/');
      if (!res.ok) throw new Error('notifications');
      const data = await res.json();
      setItems(data.results ?? data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    load();
  }, [authLoading, isAuthenticated, load]);

  const markRead = async (id: number) => {
    // Update straight away; the request is a formality the list doesn't wait on.
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, is_read: true } : item))
    );
    await apiFetch(`/shop/notifications/${id}/read/`, { method: 'POST' }).catch(() => {});
  };

  const markAllRead = async () => {
    setItems((current) => current.map((item) => ({ ...item, is_read: true })));
    await apiFetch('/shop/notifications/read-all/', { method: 'POST' }).catch(() => {});
  };

  const formatTime = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));

  const unread = items.filter((item) => !item.is_read).length;

  return (
    <div className="max-w-[768px] mx-auto px-4 md:px-8 py-12 md:py-16">
      <SEO title={t('notifications.title')} noindex />

      <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
        <h1 className="headline-xl">{t('notifications.title')}</h1>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="label-sm text-primary hover:underline lowercase tracking-normal"
          >
            {t('notifications.mark_all_read')}
          </button>
        )}
      </div>

      {authLoading || loading ? (
        <div className="flex justify-center py-16">
          <Icons.Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : !isAuthenticated ? (
        <div className="rounded-sm border border-dashed border-outline-variant px-6 py-14 text-center">
          <p className="body-md text-secondary mb-4">{t('notifications.sign_in_prompt')}</p>
          <Link
            to="/login"
            className="inline-block rounded-sm bg-primary px-8 py-3 label-md text-on-primary hover:opacity-90 transition-opacity"
          >
            {t('auth.sign_in')}
          </Link>
        </div>
      ) : error ? (
        <p className="body-md text-error">{t('notifications.load_error')}</p>
      ) : items.length === 0 ? (
        <div className="rounded-sm border border-dashed border-outline-variant px-6 py-14 text-center">
          <Icons.Bell size={28} className="mx-auto mb-4 text-secondary" />
          <p className="body-md text-secondary">{t('notifications.empty')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {items.map((notif, idx) => {
            const Icon = KIND_ICON[notif.kind] ?? Icons.Bell;
            const isUnread = !notif.is_read;
            return (
              <motion.article
                key={notif.id}
                {...fadeUp}
                transition={{ ...tweenFast, delay: Math.min(idx * 0.04, 0.2) }}
                className={cn(
                  'relative flex flex-col md:flex-row gap-8 items-start rounded-sm border border-surface-variant p-8',
                  isUnread ? 'bg-surface shadow-xl shadow-black/5' : 'bg-surface-bright'
                )}
              >
                {isUnread && <div className="absolute top-0 left-0 h-1 w-full bg-primary" />}

                <div
                  className={cn(
                    'shrink-0 rounded-sm border border-surface-variant bg-surface-container-low p-4',
                    isUnread ? 'text-primary' : 'text-secondary'
                  )}
                >
                  <Icon size={32} />
                </div>

                <div className="flex flex-grow flex-col gap-2">
                  <div className="flex w-full items-start justify-between gap-4">
                    <h2 className="headline-md text-xl">{notif.title}</h2>
                    <span className="label-sm shrink-0 text-secondary lowercase tracking-normal">
                      {formatTime(notif.created_at)}
                    </span>
                  </div>
                  {notif.message && (
                    <p className="body-md mt-2 max-w-xl text-on-surface-variant">{notif.message}</p>
                  )}

                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    {notif.link && (
                      <Link
                        to={notif.link}
                        onClick={() => markRead(notif.id)}
                        className="rounded-sm bg-primary px-8 py-3 label-md font-bold text-on-primary transition-opacity hover:opacity-90"
                      >
                        {notif.action_label || t('notifications.view')}
                      </Link>
                    )}
                    {isUnread && (
                      <button
                        onClick={() => markRead(notif.id)}
                        className="rounded-sm border border-surface-variant px-8 py-3 label-md font-normal lowercase tracking-normal text-secondary transition-colors hover:bg-surface-container"
                      >
                        {t('notifications.mark_read')}
                      </button>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
}
