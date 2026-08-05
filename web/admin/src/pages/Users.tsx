import { useEffect, useState } from 'react';
import { 
  Users as UsersIcon, 
  Search, 
  MoreVertical, 
  Mail, 
  Phone, 
  MapPin,
  Loader2,
  AlertCircle,
  Calendar,
  Cake,
  Send,
  Trash2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '../lib/api';
import { formatApiErrors } from '../lib/formatApiErrors';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { Pagination } from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';

import { cn } from '../lib/utils';

export default function Users() {
  const { t, i18n } = useTranslation();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isSendingBirthdayTest, setIsSendingBirthdayTest] = useState(false);
  const [sendingBirthdayCustomerId, setSendingBirthdayCustomerId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    date_of_birth: '',
    preferred_language: 'vi',
    birthday_email_enabled: true
  });

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/users/?is_staff=false');
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
        setError(null);
      } else {
        setError(t('users.error_load'));
      }
    } catch (err) {
      setError(t('common.error_occurred'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleOpenModal = (user: any) => {
    setEditingUser(user);
    setFormData({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
      date_of_birth: user.date_of_birth || '',
      preferred_language: user.preferred_language || 'vi',
      birthday_email_enabled: user.birthday_email_enabled ?? true
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiFetch(`/users/${editingUser.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...formData,
          date_of_birth: formData.date_of_birth || null,
        })
      });

      if (response.ok) {
        setIsModalOpen(false);
        fetchCustomers();
      } else {
        const errData = await response.json();
        alert(formatApiErrors(errData));
      }
    } catch (err) {
      console.error('Submit error:', err);
    }
  };

  const handleBirthdayEmailTest = async () => {
    if (!editingUser) return;
    setIsSendingBirthdayTest(true);
    try {
      const response = await apiFetch(
        `/users/${editingUser.id}/send-birthday-email-test/`,
        {
          method: 'POST',
          body: JSON.stringify({ language: formData.preferred_language }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(data.detail || t('users.modal.birthday_test_failed'));
        return;
      }
      alert(t('users.modal.birthday_test_sent', { email: data.sent_to }));
    } catch {
      alert(t('users.modal.birthday_test_failed'));
    } finally {
      setIsSendingBirthdayTest(false);
    }
  };

  const handleSendBirthdayEmail = async (user: any) => {
    if (!confirm(t('users.birthday_email.confirm', { email: user.email }))) return;
    setSendingBirthdayCustomerId(user.id);
    try {
      const response = await apiFetch(`/users/${user.id}/send-birthday-email/`, {
        method: 'POST',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorKey = data.error_code
          ? `users.birthday_email.errors.${data.error_code}`
          : 'users.birthday_email.failed';
        alert(t(errorKey, { defaultValue: data.detail || t('users.birthday_email.failed') }));
        return;
      }
      alert(
        data.status === 'already_sent'
          ? t('users.birthday_email.already_sent', {
              email: data.sent_to,
              coupon: data.coupon_code,
            })
          : t('users.birthday_email.sent', {
              email: data.sent_to,
              coupon: data.coupon_code,
            }),
      );
    } catch {
      alert(t('users.birthday_email.failed'));
    } finally {
      setSendingBirthdayCustomerId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('users.confirm_delete'))) return;
    
    try {
      const response = await apiFetch(`/users/${id}/`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchCustomers();
      } else {
        alert(t('users.error_delete'));
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.first_name + ' ' + c.last_name).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    paginatedItems: paginatedCustomers,
    totalItems,
    start,
    end,
  } = usePagination(filteredCustomers, [searchQuery]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-brand-red" />
        <p className="text-sm font-serif italic text-brand-ink/40">{t('users.loading')}</p>
      </div>
    );
  }

  return (
    <div className="ma-spacing space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <p className="text-xs font-medium text-brand-red tracking-[0.2em] uppercase mb-2">{t('users.subtitle')}</p>
          <h1 className="text-4xl font-serif font-bold">{t('users.title')}</h1>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-brand-clay shadow-sm overflow-hidden">
        <div className="p-4 border-b border-brand-clay bg-brand-paper/30">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/30" size={18} />
            <input 
              type="text" 
              placeholder={t('users.search_placeholder')} 
              className="w-full pl-10 pr-4 py-2 bg-white border border-brand-clay rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {error ? (
          <div className="p-12 text-center space-y-4">
            <div className="inline-flex p-3 bg-red-50 text-brand-red rounded-full">
              <AlertCircle size={24} />
            </div>
            <p className="text-brand-ink/60 font-serif italic">{error}</p>
            <button onClick={fetchCustomers} className="text-brand-red text-sm font-bold hover:underline">{t('common.try_again')}</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-brand-paper">
                <tr>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">{t('users.table.collector')}</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">{t('users.table.contact')}</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">{t('users.table.location')}</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">{t('users.table.member_since')}</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50 text-right">{t('users.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-clay">
                <AnimatePresence mode="popLayout">
                  {paginatedCustomers.map((user) => (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={user.id} 
                      className="hover:bg-brand-paper/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-brand-clay/20 border border-brand-clay flex items-center justify-center text-brand-red font-serif">
                            {user.first_name?.[0] || user.username[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-brand-ink">
                              {user.first_name || user.last_name ? `${user.first_name} ${user.last_name}` : user.username}
                            </p>
                            <p className="text-[10px] text-brand-ink/40 font-mono italic">@{user.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 space-y-1">
                        <div className="flex items-center gap-2 text-xs text-brand-ink/60">
                          <Mail size={12} className="text-brand-ink/30" />
                          <span>{user.email}</span>
                        </div>
                        {user.phone && (
                          <div className="flex items-center gap-2 text-xs text-brand-ink/60">
                            <Phone size={12} className="text-brand-ink/30" />
                            <span>{user.phone}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {user.address ? (
                          <div className="flex items-start gap-2 text-xs text-brand-ink/60 max-w-xs">
                            <MapPin size={12} className="mt-0.5 text-brand-ink/30 shrink-0" />
                            <span className="line-clamp-2">{user.address}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-brand-ink/30 italic">{t('users.table.not_provided')}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1.5 text-xs text-brand-ink/40">
                          <div className="flex items-center gap-2">
                            <Calendar size={12} />
                            <span>{new Date(user.date_joined).toLocaleDateString(i18n.language)}</span>
                          </div>
                          {user.date_of_birth && (
                            <div className="flex items-center gap-2 text-brand-red/70">
                              <Cake size={12} />
                              <span>{new Date(`${user.date_of_birth}T00:00:00`).toLocaleDateString(i18n.language)}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleSendBirthdayEmail(user)}
                            disabled={!user.date_of_birth || sendingBirthdayCustomerId === user.id}
                            className="p-2 text-brand-red transition-colors hover:bg-brand-red hover:text-white rounded-md disabled:cursor-not-allowed disabled:opacity-30"
                            title={t('users.birthday_email.action')}
                          >
                            {sendingBirthdayCustomerId === user.id
                              ? <Loader2 size={16} className="animate-spin" />
                              : <Cake size={16} />}
                          </button>
                          <button 
                            onClick={() => handleOpenModal(user)}
                            className="p-2 hover:bg-brand-ink hover:text-white rounded-md transition-colors"
                            title={t('common.edit')}
                          >
                            <MoreVertical size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(user.id)}
                            className="p-2 hover:bg-brand-red hover:text-white rounded-md transition-colors text-brand-red"
                            title={t('common.delete')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <p className="font-serif italic text-brand-ink/30 text-lg">{t('users.table.empty')}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          totalItems={totalItems}
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          start={start}
          end={end}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-brand-ink/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-2xl"
            >
              <div className="p-6 border-b border-brand-clay flex justify-between items-center bg-brand-paper/50">
                <h2 className="text-xl font-serif font-bold">{t('users.modal.edit_title')}</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-brand-ink/40 hover:text-brand-red">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">{t('users.modal.first_name')}</label>
                    <input 
                      className="w-full px-3 py-2 border border-brand-clay rounded-md text-sm"
                      value={formData.first_name}
                      onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">{t('users.modal.last_name')}</label>
                    <input 
                      className="w-full px-3 py-2 border border-brand-clay rounded-md text-sm"
                      value={formData.last_name}
                      onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">{t('users.modal.email')}</label>
                  <input 
                    type="email"
                    className="w-full px-3 py-2 border border-brand-clay rounded-md text-sm"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">{t('users.modal.phone')}</label>
                  <input 
                    className="w-full px-3 py-2 border border-brand-clay rounded-md text-sm"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">{t('users.modal.date_of_birth')}</label>
                  <input
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    className="w-full px-3 py-2 border border-brand-clay rounded-md text-sm"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">{t('users.modal.email_language')}</label>
                  <select
                    className="w-full px-3 py-2 border border-brand-clay rounded-md text-sm bg-white"
                    value={formData.preferred_language}
                    onChange={(e) => setFormData({...formData, preferred_language: e.target.value})}
                  >
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                    <option value="ja">日本語</option>
                  </select>
                </div>
                <label className="flex items-center gap-3 rounded-md border border-brand-clay px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.birthday_email_enabled}
                    onChange={(e) => setFormData({...formData, birthday_email_enabled: e.target.checked})}
                    className="accent-brand-red"
                  />
                  <span>{t('users.modal.birthday_email_enabled')}</span>
                </label>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">{t('users.modal.address')}</label>
                  <textarea 
                    className="w-full px-3 py-2 border border-brand-clay rounded-md text-sm"
                    rows={3}
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSendBirthdayEmail(editingUser)}
                  disabled={!editingUser?.date_of_birth || sendingBirthdayCustomerId === editingUser?.id}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-red px-4 py-2 text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sendingBirthdayCustomerId === editingUser?.id
                    ? <Loader2 size={16} className="animate-spin" />
                    : <Cake size={16} />}
                  {sendingBirthdayCustomerId === editingUser?.id
                    ? t('users.birthday_email.sending')
                    : t('users.birthday_email.action')}
                </button>
                <button
                  type="button"
                  onClick={handleBirthdayEmailTest}
                  disabled={isSendingBirthdayTest}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-brand-red px-4 py-2 text-sm text-brand-red transition-colors hover:bg-brand-red hover:text-white disabled:opacity-50"
                >
                  {isSendingBirthdayTest ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {isSendingBirthdayTest ? t('users.modal.birthday_test_sending') : t('users.modal.birthday_test')}
                </button>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-brand-clay rounded-md text-sm"
                  >
                    {t('users.modal.cancel')}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2 bg-brand-ink text-white rounded-md text-sm hover:bg-brand-red transition-colors"
                  >
                    {t('users.modal.update_button')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
