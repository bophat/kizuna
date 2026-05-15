import { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Globe, 
  Palette, 
  Shield, 
  Mail, 
  Bell, 
  Database,
  Save,
  CheckCircle2,
  Image as ImageIcon
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';

export default function Settings() {
  const { t } = useTranslation();
  
  const SECTIONS = [
    { id: 'general', label: t('settings.sections.general'), icon: Globe },
    { id: 'gallery', label: t('settings.sections.gallery'), icon: Palette },
    { id: 'security', label: t('settings.sections.security'), icon: Shield },
    { id: 'notifications', label: t('settings.sections.notifications'), icon: Bell },
    { id: 'database', label: t('settings.sections.database'), icon: Database },
  ];

  const [activeSection, setActiveSection] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 1000);
  };

  return (
    <div className="ma-spacing space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <p className="text-xs font-medium text-brand-red tracking-[0.2em] uppercase mb-2">{t('settings.subtitle')}</p>
          <h1 className="text-4xl font-serif font-bold text-brand-ink">{t('settings.title')}</h1>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-brand-ink text-white px-8 py-3 rounded-md text-xs font-bold uppercase tracking-widest hover:bg-brand-red transition-all flex items-center gap-2 shadow-xl hover:shadow-brand-red/20 disabled:opacity-50"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : showSuccess ? (
            <CheckCircle2 size={16} />
          ) : (
            <Save size={16} />
          )}
          <span>{showSuccess ? t('settings.saved') : t('settings.save_button')}</span>
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Nav */}
        <div className="w-full lg:w-64 space-y-1">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                activeSection === section.id 
                  ? "bg-brand-red text-white shadow-lg shadow-brand-red/20" 
                  : "text-brand-ink/60 hover:bg-brand-paper hover:text-brand-ink"
              )}
            >
              <section.icon size={18} />
              {section.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-xl border border-brand-clay shadow-sm overflow-hidden">
          <div className="p-8 border-b border-brand-clay bg-brand-paper/20">
            <h2 className="text-xl font-serif font-bold text-brand-ink">
              {SECTIONS.find(s => s.id === activeSection)?.label}
            </h2>
            <p className="text-sm text-brand-ink/40 mt-1 italic font-serif">
              {t('settings.description')}
            </p>
          </div>

          <div className="p-8 space-y-8">
            {activeSection === 'general' && (
              <div className="space-y-6 max-w-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-brand-ink/40">{t('settings.general.gallery_name')}</label>
                    <input 
                      type="text" 
                      defaultValue="KIZUNA Curations"
                      className="w-full bg-white border border-brand-clay rounded-md px-4 py-3 text-sm focus:outline-none focus:border-brand-red"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-brand-ink/40">{t('settings.general.primary_contact')}</label>
                    <input 
                      type="email" 
                      defaultValue="concierge@kizuna-gallery.jp"
                      className="w-full bg-white border border-brand-clay rounded-md px-4 py-3 text-sm focus:outline-none focus:border-brand-red"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-brand-ink/40">{t('settings.general.status')}</label>
                  <div className="flex gap-4">
                    <label className="flex-1 cursor-pointer group">
                      <input type="radio" name="status" className="hidden peer" defaultChecked />
                      <div className="p-4 border border-brand-clay rounded-lg peer-checked:border-brand-red peer-checked:bg-brand-red/5 transition-all">
                        <p className="text-xs font-bold uppercase tracking-widest text-brand-ink group-hover:text-brand-red">{t('settings.general.active')}</p>
                        <p className="text-[10px] text-brand-ink/40 mt-1">{t('settings.general.active_desc')}</p>
                      </div>
                    </label>
                    <label className="flex-1 cursor-pointer group">
                      <input type="radio" name="status" className="hidden peer" />
                      <div className="p-4 border border-brand-clay rounded-lg peer-checked:border-brand-red peer-checked:bg-brand-red/5 transition-all">
                        <p className="text-xs font-bold uppercase tracking-widest text-brand-ink group-hover:text-brand-red">{t('settings.general.maintenance')}</p>
                        <p className="text-[10px] text-brand-ink/40 mt-1">{t('settings.general.maintenance_desc')}</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'gallery' && (
              <div className="space-y-6 max-w-2xl">
                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-brand-ink/40">{t('settings.gallery.theme')}</label>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { key: 'classic', label: t('settings.gallery.themes.classic') },
                      { key: 'modern', label: t('settings.gallery.themes.modern') },
                      { key: 'minimalist', label: t('settings.gallery.themes.minimalist') }
                    ].map((theme) => (
                      <div key={theme.key} className="aspect-video bg-brand-paper border border-brand-clay rounded-md flex flex-col items-center justify-center gap-2 group cursor-pointer hover:border-brand-red transition-all">
                        <Palette size={20} className="text-brand-ink/20 group-hover:text-brand-red transition-all" />
                        <span className="text-[10px] font-bold uppercase tracking-tighter">{theme.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-brand-ink/40">{t('settings.gallery.grid')}</label>
                  <select className="w-full bg-white border border-brand-clay rounded-md px-4 py-3 text-sm focus:outline-none focus:border-brand-red">
                    <option>{t('settings.gallery.grid_options.spacious')}</option>
                    <option selected>{t('settings.gallery.grid_options.balanced')}</option>
                    <option>{t('settings.gallery.grid_options.dense')}</option>
                  </select>
                </div>
                <div className="flex items-center gap-4 p-4 bg-brand-paper/50 rounded-lg border border-dashed border-brand-clay">
                  <div className="w-12 h-12 bg-white rounded border border-brand-clay flex items-center justify-center">
                    <ImageIcon size={20} className="text-brand-ink/20" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-widest">{t('settings.gallery.logo_favicon')}</p>
                    <p className="text-[10px] text-brand-ink/40">{t('settings.gallery.logo_desc')}</p>
                  </div>
                  <button className="text-[10px] font-bold uppercase text-brand-red hover:underline">{t('settings.gallery.replace')}</button>
                </div>
              </div>
            )}

            {activeSection === 'security' && (
              <div className="space-y-6 max-w-2xl">
                <div className="p-4 bg-red-50 border border-brand-red/20 rounded-lg flex gap-4">
                  <Shield className="text-brand-red flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-brand-red uppercase tracking-widest">{t('settings.security.two_factor')}</p>
                    <p className="text-xs text-brand-ink/60 mt-1">{t('settings.security.two_factor_desc')}</p>
                    <button className="mt-3 bg-brand-red text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-widest">{t('settings.security.configure_2fa')}</button>
                  </div>
                </div>
                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest">{t('settings.security.audit_logs')}</p>
                      <p className="text-[10px] text-brand-ink/40">{t('settings.security.audit_logs_desc')}</p>
                    </div>
                    <button className="text-[10px] font-bold uppercase text-brand-red hover:underline">{t('settings.security.view_history')}</button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest">{t('settings.security.ip_whitelisting')}</p>
                      <p className="text-[10px] text-brand-ink/40">{t('settings.security.ip_whitelisting_desc')}</p>
                    </div>
                    <button className="text-[10px] font-bold uppercase text-brand-red hover:underline">{t('settings.security.manage_ips')}</button>
                  </div>
                </div>
              </div>
            )}
            
            {(activeSection === 'notifications' || activeSection === 'database') && (
              <div className="py-20 text-center space-y-4">
                <div className="inline-flex p-4 bg-brand-paper rounded-full text-brand-ink/20">
                  <SettingsIcon size={32} />
                </div>
                <p className="text-sm font-serif italic text-brand-ink/40">{t('settings.coming_soon', { section: activeSection })}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

