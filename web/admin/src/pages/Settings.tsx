import { useState, useEffect } from 'react';
import { Loader2, Save, Upload, Image as ImageIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../hooks/useSettings';
import { toast } from '@izuna/shared/lib/toast';
import { apiFetch, getMediaUrl } from '../lib/api';

export default function Settings() {
  const { t } = useTranslation();
  const { settings, loading, updateSetting } = useSettings();
  const [publicSiteUrl, setPublicSiteUrl] = useState('');
  const [loginBg, setLoginBg] = useState<string | null>(null);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [heroBg, setHeroBg] = useState<string | null>(null);
  const [uploadingHeroBg, setUploadingHeroBg] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings['PUBLIC_SITE_URL']) {
      setPublicSiteUrl(settings['PUBLIC_SITE_URL']);
    }
    if (settings['login_background_image']) {
      setLoginBg(getMediaUrl(settings['login_background_image']));
    }
    if (settings['home_hero_image']) {
      setHeroBg(getMediaUrl(settings['home_hero_image']));
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSetting('PUBLIC_SITE_URL', publicSiteUrl);
      toast.success(t('common.success') || toast.messages.saveSuccess);
    } catch (err) {
      toast.error(t('common.error_occurred') || toast.messages.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBg(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await apiFetch('/settings/upload-login-background/', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setLoginBg(getMediaUrl(data.url));
      toast.success('Background image updated');
    } catch {
      toast.error('Failed to upload background image');
    } finally {
      setUploadingBg(false);
    }
  };

  const handleHeroBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHeroBg(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await apiFetch('/settings/upload-home-hero-image/', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setHeroBg(getMediaUrl(data.url));
      toast.success('Hero image updated');
    } catch {
      toast.error('Failed to upload hero image');
    } finally {
      setUploadingHeroBg(false);
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

        <div className="px-8 py-4 bg-brand-paper/30 border-t border-brand-clay flex justify-end items-center">
          <div className="flex items-center gap-4">
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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="bg-white rounded-xl border border-brand-clay shadow-sm overflow-hidden"
      >
        <div className="p-8 space-y-6">
          <div>
            <h3 className="text-lg font-serif font-bold text-brand-ink mb-2">Login Background Image</h3>
            <p className="text-xs text-brand-ink/50 italic font-serif">Upload a background image for the login page. Max 5MB. JPEG, PNG, WEBP, GIF.</p>
          </div>

          {loginBg && (
            <div className="relative w-full h-48 rounded-md overflow-hidden border border-brand-clay">
              <img src={loginBg} alt="Login background preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
          )}

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <span className="flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-white rounded-md text-sm hover:bg-brand-red transition-all disabled:opacity-50">
                {uploadingBg ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploadingBg ? 'Uploading...' : 'Choose Image'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleBgUpload}
                disabled={uploadingBg}
              />
              {!loginBg && (
                <span className="text-xs text-brand-ink/40 italic font-serif flex items-center gap-1">
                  <ImageIcon size={14} /> No image set — using default
                </span>
              )}
            </label>
          </div>

          <div className="pt-8 border-t border-brand-clay">
            <h3 className="text-lg font-serif font-bold text-brand-ink mb-2">Home Hero Image</h3>
            <p className="text-xs text-brand-ink/50 italic font-serif">Upload a background image for the website's home page hero section. Max 5MB.</p>
          </div>

          {heroBg && (
            <div className="relative w-full h-48 rounded-md overflow-hidden border border-brand-clay">
              <img src={heroBg} alt="Hero background preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
          )}

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <span className="flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-white rounded-md text-sm hover:bg-brand-red transition-all disabled:opacity-50">
                {uploadingHeroBg ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploadingHeroBg ? 'Uploading...' : 'Choose Image'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleHeroBgUpload}
                disabled={uploadingHeroBg}
              />
              {!heroBg && (
                <span className="text-xs text-brand-ink/40 italic font-serif flex items-center gap-1">
                  <ImageIcon size={14} /> No image set — using default
                </span>
              )}
            </label>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
