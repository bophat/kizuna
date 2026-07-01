import { useState, useEffect } from 'react';
import { Loader2, Save, Upload, Image as ImageIcon, Type, Key } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../hooks/useSettings';
import { toast } from '@izuna/shared/lib/toast';
import { PUBLIC_CONTENT_KEYS } from '@izuna/shared/lib/publicSettings';
import { INTEGRATION_KEYS, migrateLegacySocialSettings, serializeSocialIntegrations, type SocialAccount } from '@izuna/shared/lib/integrationSettings';
import { secretFieldPlaceholder } from '@izuna/shared/lib/secretMask';
import { SocialAccountsSection } from '../components/settings/SocialAccountsSection';
import { apiFetch, getMediaUrl } from '../lib/api';
import { useChatbot } from '../contexts/ChatbotContext';

export default function Settings() {
  const { t } = useTranslation();
  const { settings, loading, updateSetting, updateSettingsBatch } = useSettings();
  const { refresh: refreshChatbot } = useChatbot();
  const [publicSiteUrl, setPublicSiteUrl] = useState('');
  const [loginBg, setLoginBg] = useState<string | null>(null);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [heroBg, setHeroBg] = useState<string | null>(null);
  const [uploadingHeroBg, setUploadingHeroBg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingContent, setSavingContent] = useState(false);
  const [homeHeroTitle, setHomeHeroTitle] = useState('');
  const [homeHeroSubtitle, setHomeHeroSubtitle] = useState('');
  const [homeHeroCta, setHomeHeroCta] = useState('');
  const [loginHeroText, setLoginHeroText] = useState('');
  const [savingIntegrations, setSavingIntegrations] = useState(false);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [geminiKey, setGeminiKey] = useState('');
  const [serperKey, setSerperKey] = useState('');
  const [repostEnabled, setRepostEnabled] = useState('true');
  const [repostPostsPerDay, setRepostPostsPerDay] = useState('20');
  const [repostDelay, setRepostDelay] = useState('15');
  const [chatbotUrl, setChatbotUrl] = useState('');
  const [chatbotToken, setChatbotToken] = useState('');
  const [chatbotEnabled, setChatbotEnabled] = useState('false');

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
    setHomeHeroTitle(settings[PUBLIC_CONTENT_KEYS.homeHeroTitle] || '');
    setHomeHeroSubtitle(settings[PUBLIC_CONTENT_KEYS.homeHeroSubtitle] || '');
    setHomeHeroCta(settings[PUBLIC_CONTENT_KEYS.homeHeroCta] || '');
    setLoginHeroText(settings[PUBLIC_CONTENT_KEYS.loginHeroText] || '');
    setSocialAccounts(migrateLegacySocialSettings(settings));
    setGeminiKey(settings[INTEGRATION_KEYS.geminiApiKey] || '');
    setSerperKey(settings[INTEGRATION_KEYS.serperApiKey] || '');
    setRepostEnabled(settings[INTEGRATION_KEYS.repostEnabled] || 'true');
    setRepostPostsPerDay(settings[INTEGRATION_KEYS.repostPostsPerDay] || '20');
    setRepostDelay(settings[INTEGRATION_KEYS.repostDelayMinutes] || '15');
    setChatbotUrl(settings[INTEGRATION_KEYS.chatbotServiceUrl] || '');
    setChatbotToken(settings[INTEGRATION_KEYS.chatbotInternalToken] || '');
    setChatbotEnabled(settings[INTEGRATION_KEYS.chatbotEnabled] || 'false');
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

  const handleContentSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingContent(true);
    try {
      await Promise.all([
        updateSetting(PUBLIC_CONTENT_KEYS.homeHeroTitle, homeHeroTitle),
        updateSetting(PUBLIC_CONTENT_KEYS.homeHeroSubtitle, homeHeroSubtitle),
        updateSetting(PUBLIC_CONTENT_KEYS.homeHeroCta, homeHeroCta),
        updateSetting(PUBLIC_CONTENT_KEYS.loginHeroText, loginHeroText),
      ]);
      toast.success(t('common.success') || toast.messages.saveSuccess);
    } catch {
      toast.error(t('common.error_occurred') || toast.messages.saveError);
    } finally {
      setSavingContent(false);
    }
  };

  const handleIntegrationsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingIntegrations(true);
    try {
      await updateSettingsBatch({
        [INTEGRATION_KEYS.socialIntegrations]: serializeSocialIntegrations(socialAccounts),
        [INTEGRATION_KEYS.geminiApiKey]: geminiKey,
        [INTEGRATION_KEYS.serperApiKey]: serperKey,
        [INTEGRATION_KEYS.repostEnabled]: repostEnabled,
        [INTEGRATION_KEYS.repostPostsPerDay]: repostPostsPerDay,
        [INTEGRATION_KEYS.repostDelayMinutes]: repostDelay,
        [INTEGRATION_KEYS.chatbotServiceUrl]: chatbotUrl,
        [INTEGRATION_KEYS.chatbotInternalToken]: chatbotToken,
        [INTEGRATION_KEYS.chatbotEnabled]: chatbotEnabled,
      });
      await refreshChatbot();
      toast.success('Integration settings saved');
    } catch {
      toast.error('Failed to save integrations');
    } finally {
      setSavingIntegrations(false);
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

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        onSubmit={handleContentSave}
        className="bg-white rounded-xl border border-brand-clay shadow-sm overflow-hidden"
      >
        <div className="p-8 space-y-8">
          <div className="flex items-center gap-2">
            <Type size={20} className="text-brand-red" />
            <div>
              <h3 className="text-lg font-serif font-bold text-brand-ink">Page Content</h3>
              <p className="text-xs text-brand-ink/50 italic font-serif">
                Custom text for the website home hero and admin login page. Leave blank to use default translations.
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-2 border-t border-brand-clay">
            <h4 className="text-sm font-semibold text-brand-ink uppercase tracking-wider">Website — Home Hero</h4>
            <div>
              <label className="block text-sm font-semibold text-brand-ink mb-1">Headline</label>
              <input
                type="text"
                value={homeHeroTitle}
                onChange={(e) => setHomeHeroTitle(e.target.value)}
                placeholder="静寂の芸術"
                className="w-full px-4 py-2 border border-brand-clay rounded-md focus:outline-none focus:border-brand-red/30 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-ink mb-1">Subtitle</label>
              <textarea
                value={homeHeroSubtitle}
                onChange={(e) => setHomeHeroSubtitle(e.target.value)}
                rows={3}
                placeholder="日本全国の巨匠によって手作りされた…"
                className="w-full px-4 py-2 border border-brand-clay rounded-md focus:outline-none focus:border-brand-red/30 transition-colors resize-y"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-ink mb-1">Button label</label>
              <input
                type="text"
                value={homeHeroCta}
                onChange={(e) => setHomeHeroCta(e.target.value)}
                placeholder="コレクションを見る"
                className="w-full px-4 py-2 border border-brand-clay rounded-md focus:outline-none focus:border-brand-red/30 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-brand-clay">
            <h4 className="text-sm font-semibold text-brand-ink uppercase tracking-wider">Admin — Login Side Panel</h4>
            <div>
              <label className="block text-sm font-semibold text-brand-ink mb-1">Hero quote</label>
              <textarea
                value={loginHeroText}
                onChange={(e) => setLoginHeroText(e.target.value)}
                rows={3}
                placeholder="Curating the finest traditions of Japanese craftsmanship…"
                className="w-full px-4 py-2 border border-brand-clay rounded-md focus:outline-none focus:border-brand-red/30 transition-colors resize-y"
              />
            </div>
          </div>
        </div>

        <div className="px-8 py-4 bg-brand-paper/30 border-t border-brand-clay flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2 bg-brand-ink text-white rounded-md text-sm hover:bg-brand-red transition-all disabled:opacity-50"
            disabled={savingContent}
          >
            {savingContent ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {t('settings.save_button') || t('common.save')}
          </button>
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

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        onSubmit={handleIntegrationsSave}
        className="bg-white rounded-xl border border-brand-clay shadow-sm overflow-hidden"
      >
        <div className="p-8 space-y-6">
          <div className="flex items-center gap-2">
            <Key size={20} className="text-brand-red" />
            <div>
              <h3 className="text-lg font-serif font-bold text-brand-ink">AI & Social Integrations</h3>
              <p className="text-xs text-brand-ink/50 italic font-serif">
                Connect social networks, AI keys, and chatbot service. Add multiple platforms below.
              </p>
            </div>
          </div>

          <SocialAccountsSection accounts={socialAccounts} onChange={setSocialAccounts} />

          <div className="grid gap-4 sm:grid-cols-2 pt-6 border-t border-brand-clay">
            <h4 className="sm:col-span-2 text-sm font-semibold text-brand-ink uppercase tracking-wider">
              AI & Chatbot service
            </h4>
            <div className="sm:col-span-2 rounded-lg border border-brand-clay bg-brand-paper/30 p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-brand-ink">Flask live-chat service</p>
                <p className="text-xs text-brand-ink/50 mt-1 italic font-serif">
                  Bật khi chạy Flask (port 8080): đồng bộ tin website → admin, thông báo realtime, Facebook bot.
                  Tắt khi không dùng — khách vẫn chat AI Concierge bình thường.
                </p>
              </div>
              <label className="inline-flex items-center gap-3 cursor-pointer">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-ink/50">
                  {chatbotEnabled === 'true' ? 'On' : 'Off'}
                </span>
                <input
                  type="checkbox"
                  checked={chatbotEnabled === 'true'}
                  onChange={(e) => setChatbotEnabled(e.target.checked ? 'true' : 'false')}
                  className="w-5 h-5 rounded border-brand-clay text-brand-red focus:ring-brand-red/30"
                />
              </label>
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-ink mb-1">Gemini API Key</label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder={secretFieldPlaceholder(geminiKey)}
                autoComplete="off"
                className="w-full px-4 py-2 border border-brand-clay rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-ink mb-1">Serper API Key (web search)</label>
              <input
                type="password"
                value={serperKey}
                onChange={(e) => setSerperKey(e.target.value)}
                placeholder={secretFieldPlaceholder(serperKey)}
                autoComplete="off"
                className="w-full px-4 py-2 border border-brand-clay rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-ink mb-1">Auto-repost enabled</label>
              <select value={repostEnabled} onChange={(e) => setRepostEnabled(e.target.value)}
                className="w-full px-4 py-2 border border-brand-clay rounded-md text-sm">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
              <p className="text-xs text-brand-ink/40 mt-1 italic">Uses Group IDs from Facebook accounts above.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-ink mb-1">Posts per day</label>
              <input type="number" value={repostPostsPerDay} onChange={(e) => setRepostPostsPerDay(e.target.value)}
                className="w-full px-4 py-2 border border-brand-clay rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-ink mb-1">Delay between posts (min)</label>
              <input type="number" value={repostDelay} onChange={(e) => setRepostDelay(e.target.value)}
                className="w-full px-4 py-2 border border-brand-clay rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-ink mb-1">Chatbot service URL</label>
              <input type="url" value={chatbotUrl} onChange={(e) => setChatbotUrl(e.target.value)}
                placeholder="http://127.0.0.1:8080"
                className="w-full px-4 py-2 border border-brand-clay rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-ink mb-1">Internal bot token</label>
              <input
                type="password"
                value={chatbotToken}
                onChange={(e) => setChatbotToken(e.target.value)}
                placeholder={secretFieldPlaceholder(chatbotToken)}
                autoComplete="off"
                className="w-full px-4 py-2 border border-brand-clay rounded-md text-sm"
              />
              <p className="text-xs text-brand-ink/40 mt-1 italic">Same value in Django + Flask + newfeed .env</p>
            </div>
          </div>
        </div>
        <div className="px-8 py-4 bg-brand-paper/30 border-t border-brand-clay flex justify-end">
          <button type="submit" disabled={savingIntegrations}
            className="flex items-center gap-2 px-6 py-2 bg-brand-ink text-white rounded-md text-sm hover:bg-brand-red disabled:opacity-50">
            {savingIntegrations ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Integrations
          </button>
        </div>
      </motion.form>
    </div>
  );
}
