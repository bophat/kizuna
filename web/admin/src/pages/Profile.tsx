import { Loader2, Save, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAdminProfile } from '../hooks/useAdminProfile';
import { ProfileAvatarSection } from '../components/profile/ProfileAvatarSection';
import { ProfileFormFields } from '../components/profile/ProfileFormFields';

export default function Profile() {
  const { t } = useTranslation();
  const {
    user,
    loading,
    saving,
    error,
    success,
    avatarPreview,
    formData,
    setFormData,
    fetchProfile,
    handleAvatarChange,
    handleSubmit,
    handleLogout,
  } = useAdminProfile();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loader2 className="w-12 h-12 animate-spin text-brand-red" />
        <p className="text-sm font-serif italic text-brand-ink/40">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-12 max-w-4xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <p className="text-xs font-medium text-brand-red tracking-[0.2em] uppercase mb-2">{t('profile.subtitle')}</p>
        <h1 className="text-4xl font-serif font-bold text-brand-ink">{t('profile.title')}</h1>
        <p className="text-sm text-brand-ink/40 mt-2 font-serif italic">{t('profile.description')}</p>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-brand-clay shadow-sm overflow-hidden"
      >
        <div className="p-8 space-y-8">
          <ProfileAvatarSection avatarPreview={avatarPreview} onAvatarChange={handleAvatarChange} />
          <ProfileFormFields formData={formData} setFormData={setFormData} user={user} />
        </div>

        <div className="px-8 py-4 bg-brand-paper/30 border-t border-brand-clay flex justify-between items-center">
          {error && <p className="text-sm text-brand-red">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-6 py-2 border border-brand-red text-brand-red rounded-md text-sm hover:bg-brand-red hover:text-white transition-all"
          >
            <LogOut size={16} />
            {t('profile.logout')}
          </button>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fetchProfile()}
              className="px-6 py-2 border border-brand-clay rounded-md text-sm text-brand-ink/60 hover:bg-brand-paper transition-colors disabled:opacity-50"
              disabled={saving}
            >
              {t('common.reset')}
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-brand-ink text-white rounded-md text-sm hover:bg-brand-red transition-all disabled:opacity-50"
              disabled={saving}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {t('common.save')}
            </button>
          </div>
        </div>
      </motion.form>
    </div>
  );
}
