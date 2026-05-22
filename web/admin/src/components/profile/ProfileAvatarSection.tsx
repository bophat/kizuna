import { User, Camera } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getMediaUrl } from '../../lib/api';

interface ProfileAvatarSectionProps {
  avatarPreview: string | null;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ProfileAvatarSection({ avatarPreview, onAvatarChange }: ProfileAvatarSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-start gap-8">
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-brand-clay/20 border-4 border-brand-paper flex items-center justify-center overflow-hidden">
          {avatarPreview ? (
            <img src={getMediaUrl(avatarPreview)} alt={t('profile.avatar_alt')} className="w-full h-full object-cover" />
          ) : (
            <User size={40} className="text-brand-ink/30" />
          )}
        </div>
        <label className="absolute bottom-0 right-0 p-2 bg-brand-red text-white rounded-full cursor-pointer hover:bg-brand-ink transition-colors shadow-lg">
          <Camera size={16} />
          <input type="file" accept="image/*" onChange={onAvatarChange} className="hidden" />
        </label>
      </div>
      <div className="flex-1 space-y-2">
        <h3 className="text-lg font-semibold text-brand-ink">{t('profile.avatar_section')}</h3>
        <p className="text-sm text-brand-ink/60">{t('profile.avatar_description')}</p>
        <p className="text-[10px] text-brand-ink/40">{t('profile.avatar_hint')}</p>
      </div>
    </div>
  );
}
