import { useEffect, useState } from 'react';
import { 
  UserSquare, 
  Search, 
  Shield, 
  Mail, 
  Plus,
  Loader2,
  AlertCircle,
  Calendar,
  MoreHorizontal,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '../lib/api';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { cn } from '../lib/utils';

export default function Staff() {
  const { t, i18n } = useTranslation();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    is_staff: true,
    is_superuser: false
  });

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/users/?is_staff=true');
      if (response.ok) {
        const data = await response.json();
        setStaff(data);
        setError(null);
      } else {
        setError(t('staff.error_load'));
      }
    } catch (err) {
      setError(t('common.error_occurred'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleOpenModal = (user: any = null) => {
    if (user) {
      setEditingStaff(user);
      setFormData({
        username: user.username || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        password: '', // Don't show password for existing users
        is_staff: user.is_staff,
        is_superuser: user.is_superuser
      });
    } else {
      setEditingStaff(null);
      setFormData({
        username: '',
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        is_staff: true,
        is_superuser: false
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEditing = !!editingStaff;
      const url = isEditing ? `/users/${editingStaff.id}/` : '/users/';
      const method = isEditing ? 'PATCH' : 'POST';
      
      const payload = { ...formData };
      // If editing and password is empty, don't send it
      if (isEditing && !payload.password) {
        delete (payload as any).password;
      }

      const response = await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      });
 
       if (response.ok) {
         setIsModalOpen(false);
         fetchStaff();
       } else {
         const errData = await response.json();
         alert(`Error: ${JSON.stringify(errData)}`);
       }
     } catch (err) {
       console.error('Submit error:', err);
     }
   };

  const handleDelete = async (id: number) => {
    if (!confirm(t('staff.confirm_delete'))) return;
    
    try {
      const response = await apiFetch(`/users/${id}/`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchStaff();
      } else {
        alert(t('staff.error_delete'));
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const filteredStaff = staff.filter(s => 
    s.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.first_name + ' ' + s.last_name).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredStaff.length / itemsPerPage);
  const paginatedStaff = filteredStaff.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-brand-red" />
        <p className="text-sm font-serif italic text-brand-ink/40">{t('staff.loading')}</p>
      </div>
    );
  }

  return (
    <div className="ma-spacing space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <p className="text-xs font-medium text-brand-red tracking-[0.2em] uppercase mb-2">{t('staff.subtitle')}</p>
          <h1 className="text-4xl font-serif font-bold">{t('staff.title')}</h1>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-brand-ink text-white rounded-md text-sm hover:bg-brand-red transition-all shadow-sm"
        >
          <Plus size={18} />
          <span>{t('staff.add_button')}</span>
        </button>
      </div>

      <div className="bg-white rounded-lg border border-brand-clay shadow-sm overflow-hidden">
        <div className="p-4 border-b border-brand-clay bg-brand-paper/30">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/30" size={18} />
            <input 
              type="text" 
              placeholder={t('staff.search_placeholder')} 
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
            <button onClick={fetchStaff} className="text-brand-red text-sm font-bold hover:underline">Try again</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-brand-paper">
                <tr>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">{t('staff.table.curator')}</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">{t('staff.table.permission')}</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">{t('staff.table.contact')}</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">{t('staff.table.joined')}</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50 text-right">{t('staff.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-clay">
                <AnimatePresence mode="popLayout">
                  {paginatedStaff.map((user) => (
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
                          <div className="w-10 h-10 rounded-md bg-brand-ink text-white flex items-center justify-center font-serif text-lg">
                            {user.username[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-brand-ink">
                              {user.first_name || user.last_name ? `${user.first_name} ${user.last_name}` : user.username}
                            </p>
                            <p className="text-[10px] text-brand-ink/40 font-mono">ID: CUR-{user.id.toString().padStart(4, '0')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Shield size={14} className="text-brand-red" />
                          <span className="text-xs font-bold uppercase tracking-wider text-brand-ink/70">
                            {user.is_superuser ? t('staff.roles.head') : t('staff.roles.staff')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs text-brand-ink/60">
                          <Mail size={12} className="text-brand-ink/30" />
                          <span>{user.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs text-brand-ink/40">
                          <Calendar size={12} />
                          <span>{new Date(user.date_joined).toLocaleDateString(i18n.language)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleOpenModal(user)}
                            className="p-2 hover:bg-brand-ink hover:text-white rounded-md transition-colors"
                            title={t('common.edit')}
                          >
                            <MoreHorizontal size={16} />
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
                {filteredStaff.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <p className="font-serif italic text-brand-ink/30 text-lg">{t('staff.table.empty')}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filteredStaff.length > 0 && (
          <div className="p-4 border-t border-brand-clay flex flex-col sm:flex-row justify-between items-center gap-4 bg-brand-paper/10">
            <div className="flex items-center gap-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-ink/40">
                {t('filter.show_per_page', { defaultValue: 'Show' })}:
              </p>
              <div className="flex gap-1">
                {[10, 20, 50].map(size => (
                  <button
                    key={size}
                    onClick={() => setItemsPerPage(size)}
                    className={cn(
                      "px-3 py-1 rounded text-[10px] font-bold transition-all border",
                      itemsPerPage === size 
                        ? "bg-brand-ink border-brand-ink text-white" 
                        : "bg-white border-brand-clay text-brand-ink/60 hover:border-brand-ink"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-2 hover:bg-brand-clay rounded-md transition-all text-brand-ink/40 hover:text-brand-red disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => {
                    if (totalPages <= 5) return true;
                    return p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1;
                  })
                  .map((p, i, arr) => (
                    <React.Fragment key={p}>
                      {i > 0 && arr[i-1] !== p - 1 && (
                        <span className="px-1 text-brand-ink/20">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(p)}
                        className={cn(
                          "w-8 h-8 rounded text-[10px] font-bold transition-all",
                          currentPage === p 
                            ? "bg-brand-red text-white" 
                            : "text-brand-ink/60 hover:bg-brand-clay"
                        )}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))
                }
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="p-2 hover:bg-brand-clay rounded-md transition-all text-brand-ink/40 hover:text-brand-red disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-ink/40 italic">
              {t('filter.showing_range', { 
                defaultValue: 'Showing {{start}}-{{end}} of {{total}}',
                start: Math.min(filteredStaff.length, (currentPage - 1) * itemsPerPage + 1),
                end: Math.min(filteredStaff.length, currentPage * itemsPerPage),
                total: filteredStaff.length
              })}
            </p>
          </div>
        )}
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
              className="relative w-full max-w-md bg-white rounded-lg shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-brand-clay flex justify-between items-center bg-brand-paper/50">
                <h2 className="text-xl font-serif font-bold">
                  {editingStaff ? t('staff.modal.update_title') : t('staff.modal.new_title')}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-brand-ink/40 hover:text-brand-red">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">{t('staff.modal.username')}</label>
                  <input 
                    className="w-full px-3 py-2 border border-brand-clay rounded-md text-sm"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    placeholder="e.g. curator_john"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">{t('staff.modal.first_name')}</label>
                    <input 
                      className="w-full px-3 py-2 border border-brand-clay rounded-md text-sm"
                      value={formData.first_name}
                      onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">{t('staff.modal.last_name')}</label>
                    <input 
                      className="w-full px-3 py-2 border border-brand-clay rounded-md text-sm"
                      value={formData.last_name}
                      onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">{t('staff.modal.email')}</label>
                  <input 
                    type="email"
                    className="w-full px-3 py-2 border border-brand-clay rounded-md text-sm"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">
                    {editingStaff ? t('staff.modal.password_new') : t('staff.modal.password_temp')}
                  </label>
                  <input 
                    type="password"
                    className="w-full px-3 py-2 border border-brand-clay rounded-md text-sm"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder={editingStaff ? t('staff.modal.password_placeholder') : "••••••••"}
                    required={!editingStaff}
                  />
                </div>
                <div className="space-y-4 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-brand-clay text-brand-red focus:ring-brand-red/20"
                      checked={formData.is_superuser}
                      onChange={(e) => setFormData({...formData, is_superuser: e.target.checked})}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-brand-ink group-hover:text-brand-red transition-colors">{t('staff.modal.head_permission')}</span>
                      <span className="text-[10px] text-brand-ink/40 uppercase tracking-tighter">{t('staff.modal.head_description')}</span>
                    </div>
                  </label>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-brand-clay rounded-md text-sm"
                  >
                    {t('staff.modal.cancel')}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2 bg-brand-ink text-white rounded-md text-sm hover:bg-brand-red transition-colors"
                  >
                    {editingStaff ? t('staff.modal.update_button') : t('staff.modal.confirm_button')}
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
