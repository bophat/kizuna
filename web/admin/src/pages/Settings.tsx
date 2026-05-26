import { useState, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../hooks/useSettings';

export default function Settings() {
  const { t } = useTranslation();
  const { settings, loading, updateSetting } = useSettings();
  const [publicSiteUrl, setPublicSiteUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (settings['PUBLIC_SITE_URL']) {
      setPublicSiteUrl(settings['PUBLIC_SITE_URL']);
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await updateSetting('PUBLIC_SITE_URL', publicSiteUrl);
      setSuccess(t('common.success') || 'Settings saved successfully');
    } catch (err) {
      setError(t('common.error_occurred') || 'Failed to save settings');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(''), 3000);
    }
  };

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
        <p className="text-xs font-medium text-brand-red tracking-[0.2em] uppercase mb-2">{t('settings.subtitle')}</p>
        <h1 className="text-4xl font-serif font-bold text-brand-ink">{t('settings.title')}</h1>
        <p className="text-sm text-brand-ink/40 mt-2 font-serif italic">{t('settings.description')}</p>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-brand-clay shadow-sm overflow-hidden"
      >
        <div className="p-8 space-y-8">
          <div>
            <h3 className="text-lg font-serif font-bold text-brand-ink mb-4">{t('settings.sections.general')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-brand-ink mb-1">
                  Public Site URL
                </label>
                <input
                  type="url"
                  value={publicSiteUrl}
                  onChange={(e) => setPublicSiteUrl(e.target.value)}
                  placeholder="https://kizuna-teal.vercel.app"
                  className="w-full px-4 py-2 border border-brand-clay rounded-md focus:outline-none focus:border-brand-red/30 transition-colors"
                />
                <p className="text-xs text-brand-ink/50 mt-1 italic font-serif">The URL used for the "View Public Site" link.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 py-4 bg-brand-paper/30 border-t border-brand-clay flex justify-between items-center">
          {error && <p className="text-sm text-brand-red">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}
          <div className="flex items-center gap-4 ml-auto">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-brand-ink text-white rounded-md text-sm hover:bg-brand-red transition-all disabled:opacity-50"
              disabled={saving}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {t('settings.save_button') || t('common.save')}
            </button>
          </div>
        </div>
      </motion.form>
    </div>
  );
}
