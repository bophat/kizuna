import { useState, useEffect } from 'react';
import { Loader2, Save, Upload, Image as ImageIcon, Type, Key } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../hooks/useSettings';
import { toast } from '@izuna/shared/lib/toast';
import {
  PUBLIC_CONTENT_KEYS,
  localizedContentKey,
  localizedContentValue,
  normalizeContentLanguage,
  type PublicContentLanguage,
} from '@izuna/shared/lib/publicSettings';
import { INTEGRATION_KEYS, migrateLegacySocialSettings, serializeSocialIntegrations, type SocialAccount } from '@izuna/shared/lib/integrationSettings';
import { secretFieldPlaceholder } from '@izuna/shared/lib/secretMask';
import { SocialAccountsSection } from '../components/settings/SocialAccountsSection';
import { PaymentSettingsSection } from '../components/settings/PaymentSettingsSection';
import { apiFetch, getMediaUrl } from '../lib/api';
import { useChatbot } from '../contexts/ChatbotContext';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { settings, loading, updateSetting, updateSettingsBatch } = useSettings();
  const { refresh: refreshChatbot } = useChatbot();
  const [publicSiteUrl, setPublicSiteUrl] = useState('');
  const [loginBg, setLoginBg] = useState<string | null>(null);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [heroBg, setHeroBg] = useState<string | null>(null);
  const [uploadingHeroBg, setUploadingHeroBg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingContent, setSavingContent] = useState(false);
  const [contentLanguage, setContentLanguage] = useState<PublicContentLanguage>(() =>
    normalizeContentLanguage(i18n.language)
  );
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

  useEffect(() => {
    const valueFor = (key: string) =>
      localizedContentValue(settings, key, contentLanguage) || '';
    setHomeHeroTitle(valueFor(PUBLIC_CONTENT_KEYS.homeHeroTitle));
    setHomeHeroSubtitle(valueFor(PUBLIC_CONTENT_KEYS.homeHeroSubtitle));
    setHomeHeroCta(valueFor(PUBLIC_CONTENT_KEYS.homeHeroCta));
    setLoginHeroText(valueFor(PUBLIC_CONTENT_KEYS.loginHeroText));
  }, [contentLanguage, settings]);

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
        updateSetting(localizedContentKey(PUBLIC_CONTENT_KEYS.homeHeroTitle, contentLanguage), homeHeroTitle),
        updateSetting(localizedContentKey(PUBLIC_CONTENT_KEYS.homeHeroSubtitle, contentLanguage), homeHeroSubtitle),
        updateSetting(localizedContentKey(PUBLIC_CONTENT_KEYS.homeHeroCta, contentLanguage), homeHeroCta),
        updateSetting(localizedContentKey(PUBLIC_CONTENT_KEYS.loginHeroText, contentLanguage), loginHeroText),
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
      toast.success(t('settings.integrations.saved'));
    } catch {
      toast.error(t('settings.integrations.save_failed'));
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
      if (!res.ok) throw new Error(t('settings.media.upload_failed'));
      const data = await res.json();
      setLoginBg(getMediaUrl(data.url));
      toast.success(t('settings.media.login_updated'));
    } catch {
      toast.error(t('settings.media.login_upload_failed'));
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
      if (!res.ok) throw new Error(t('settings.media.upload_failed'));
      const data = await res.json();
      setHeroBg(getMediaUrl(data.url));
      toast.success(t('settings.media.hero_updated'));
    } catch {
      toast.error(t('settings.media.hero_upload_failed'));
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
                  {t('settings.public_site.url')}
                </label>
                <input
                  type="url"
                  value={publicSiteUrl}
                  onChange={(e) => setPublicSiteUrl(e.target.value)}
                  placeholder="https://kizuna-teal.vercel.app"
                  className="w-full px-4 py-2 border border-brand-clay rounded-md focus:outline-none focus:border-brand-red/30 transition-colors"
                />
                <p className="text-xs text-brand-ink/50 mt-1 italic font-serif">{t('settings.public_site.url_help')}</p>
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

      <PaymentSettingsSection />

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
              <h3 className="text-lg font-serif font-bold text-brand-ink">{t('settings.content.title')}</h3>
              <p className="text-xs text-brand-ink/50 italic font-serif">
                {t('settings.content.description')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(['en', 'ja', 'vi'] as PublicContentLanguage[]).map((language) => (
              <button
                key={language}
                type="button"
                onClick={() => setContentLanguage(language)}
                className={`px-4 py-2 rounded-md text-xs font-bold uppercase border transition-colors ${
                  contentLanguage === language
                    ? 'bg-brand-red text-white border-brand-red'
                    : 'bg-white text-brand-ink/60 border-brand-clay hover:border-brand-red'
                }`}
              >
                {t(`settings.content.languages.${language}`)}
              </button>
            ))}
          </div>

          <div className="space-y-4 pt-2 border-t border-brand-clay">
            <h4 className="text-sm font-semibold text-brand-ink uppercase tracking-wider">{t('settings.content.website_hero')}</h4>
            <div>
              <label className="block text-sm font-semibold text-brand-ink mb-1">{t('settings.content.headline')}</label>
              <input
                type="text"
                value={homeHeroTitle}
                onChange={(e) => setHomeHeroTitle(e.target.value)}
                placeholder={t('settings.content.headline_placeholder')}
                className="w-full px-4 py-2 border border-brand-clay rounded-md focus:outline-none focus:border-brand-red/30 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-ink mb-1">{t('settings.content.subtitle')}</label>
              <textarea
                value={homeHeroSubtitle}
                onChange={(e) => setHomeHeroSubtitle(e.target.value)}
                rows={3}
                placeholder={t('settings.content.subtitle_placeholder')}
                className="w-full px-4 py-2 border border-brand-clay rounded-md focus:outline-none focus:border-brand-red/30 transition-colors resize-y"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-ink mb-1">{t('settings.content.button_label')}</label>
              <input
                type="text"
                value={homeHeroCta}
                onChange={(e) => setHomeHeroCta(e.target.value)}
                placeholder={t('settings.content.button_placeholder')}
                className="w-full px-4 py-2 border border-brand-clay rounded-md focus:outline-none focus:border-brand-red/30 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-brand-clay">
            <h4 className="text-sm font-semibold text-brand-ink uppercase tracking-wider">{t('settings.content.admin_login')}</h4>
            <div>
              <label className="block text-sm font-semibold text-brand-ink mb-1">{t('settings.content.hero_quote')}</label>
              <textarea
                value={loginHeroText}
                onChange={(e) => setLoginHeroText(e.target.value)}
                rows={3}
                placeholder={t('settings.content.quote_placeholder')}
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
            <h3 className="text-lg font-serif font-bold text-brand-ink mb-2">{t('settings.media.login_background')}</h3>
            <p className="text-xs text-brand-ink/50 italic font-serif">{t('settings.media.login_help')}</p>
          </div>

          {loginBg && (
            <div className="relative w-full h-48 rounded-md overflow-hidden border border-brand-clay">
              <img src={loginBg} alt={t('settings.media.login_preview')} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
          )}

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <span className="flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-white rounded-md text-sm hover:bg-brand-red transition-all disabled:opacity-50">
                {uploadingBg ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploadingBg ? t('settings.media.uploading') : t('settings.media.choose_image')}
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
                  <ImageIcon size={14} /> {t('settings.media.default_image')}
                </span>
              )}
            </label>
          </div>

          <div className="pt-8 border-t border-brand-clay">
            <h3 className="text-lg font-serif font-bold text-brand-ink mb-2">{t('settings.media.home_hero')}</h3>
            <p className="text-xs text-brand-ink/50 italic font-serif">{t('settings.media.home_hero_help')}</p>
          </div>

          {heroBg && (
            <div className="relative w-full h-48 rounded-md overflow-hidden border border-brand-clay">
              <img src={heroBg} alt={t('settings.media.hero_preview')} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
          )}

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <span className="flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-white rounded-md text-sm hover:bg-brand-red transition-all disabled:opacity-50">
                {uploadingHeroBg ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploadingHeroBg ? t('settings.media.uploading') : t('settings.media.choose_image')}
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
                  <ImageIcon size={14} /> {t('settings.media.default_image')}
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
              <h3 className="text-lg font-serif font-bold text-brand-ink">{t('settings.integrations.title')}</h3>
              <p className="text-xs text-brand-ink/50 italic font-serif">
                {t('settings.integrations.description')}
              </p>
            </div>
          </div>

          <SocialAccountsSection accounts={socialAccounts} onChange={setSocialAccounts} />

          <div className="grid gap-4 sm:grid-cols-2 pt-6 border-t border-brand-clay">
            <h4 className="sm:col-span-2 text-sm font-semibold text-brand-ink uppercase tracking-wider">
              {t('settings.integrations.ai_service')}
            </h4>
            <div className="sm:col-span-2 rounded-lg border border-brand-clay bg-brand-paper/30 p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-brand-ink">{t('settings.integrations.concierge_title')}</p>
                <p className="text-xs text-brand-ink/50 mt-1 italic font-serif">
                  {t('settings.integrations.concierge_help')}
                </p>
              </div>
              <label className="inline-flex items-center gap-3 cursor-pointer">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-ink/50">
                  {chatbotEnabled === 'true' ? t('common.on') : t('common.off')}
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
              <label className="block text-sm font-semibold text-brand-ink mb-1">{t('settings.integrations.gemini_key')}</label>
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
              <label className="block text-sm font-semibold text-brand-ink mb-1">{t('settings.integrations.serper_key')}</label>
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
              <label className="block text-sm font-semibold text-brand-ink mb-1">{t('settings.integrations.repost_enabled')}</label>
              <select value={repostEnabled} onChange={(e) => setRepostEnabled(e.target.value)}
                className="w-full px-4 py-2 border border-brand-clay rounded-md text-sm">
                <option value="true">{t('common.yes')}</option>
                <option value="false">{t('common.no')}</option>
              </select>
              <p className="text-xs text-brand-ink/40 mt-1 italic">{t('settings.integrations.repost_help')}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-ink mb-1">{t('settings.integrations.posts_per_day')}</label>
              <input type="number" value={repostPostsPerDay} onChange={(e) => setRepostPostsPerDay(e.target.value)}
                className="w-full px-4 py-2 border border-brand-clay rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-ink mb-1">{t('settings.integrations.post_delay')}</label>
              <input type="number" value={repostDelay} onChange={(e) => setRepostDelay(e.target.value)}
                className="w-full px-4 py-2 border border-brand-clay rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-ink mb-1">{t('settings.integrations.chatbot_url')}</label>
              <input type="url" value={chatbotUrl} onChange={(e) => setChatbotUrl(e.target.value)}
                placeholder="http://127.0.0.1:8080"
                className="w-full px-4 py-2 border border-brand-clay rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-ink mb-1">{t('settings.integrations.bot_token')}</label>
              <input
                type="password"
                value={chatbotToken}
                onChange={(e) => setChatbotToken(e.target.value)}
                placeholder={secretFieldPlaceholder(chatbotToken)}
                autoComplete="off"
                className="w-full px-4 py-2 border border-brand-clay rounded-md text-sm"
              />
              <p className="text-xs text-brand-ink/40 mt-1 italic">{t('settings.integrations.bot_token_help')}</p>
            </div>
          </div>
        </div>
        <div className="px-8 py-4 bg-brand-paper/30 border-t border-brand-clay flex justify-end">
          <button type="submit" disabled={savingIntegrations}
            className="flex items-center gap-2 px-6 py-2 bg-brand-ink text-white rounded-md text-sm hover:bg-brand-red disabled:opacity-50">
            {savingIntegrations ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {t('settings.integrations.save')}
          </button>
        </div>
      </motion.form>
    </div>
  );
}
