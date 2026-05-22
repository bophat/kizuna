import { Mail, Phone, MapPin, Shield, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ProfileFormData } from '../../hooks/useAdminProfile';

interface ProfileFormFieldsProps {
  formData: ProfileFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProfileFormData>>;
  user: any;
}

const inputClass =
  'w-full px-4 py-3 border border-brand-clay rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all';

export function ProfileFormFields({ formData, setFormData, user }: ProfileFormFieldsProps) {
  const { t, i18n } = useTranslation();

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">
            {t('profile.fields.username')}
          </label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            className={inputClass}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">
            {t('profile.fields.email')}
          </label>
          <div className="relative">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/30" />
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={`${inputClass} pl-10`}
              required
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">
            {t('profile.fields.first_name')}
          </label>
          <input
            type="text"
            value={formData.first_name}
            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">
            {t('profile.fields.last_name')}
          </label>
          <input
            type="text"
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">
            {t('profile.fields.phone')}
          </label>
          <div className="relative">
            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/30" />
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">
            {t('profile.fields.address')}
          </label>
          <div className="relative">
            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/30" />
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={1}
              className={`${inputClass} pl-10 resize-none`}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-brand-paper/30 rounded-lg border border-brand-clay">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold mb-2">
            {t('profile.fields.role')}
          </p>
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-brand-red" />
            <span className="px-3 py-1 bg-brand-red/10 text-brand-red text-xs font-bold uppercase rounded">
              {user?.is_superuser ? t('profile.roles.admin') : t('profile.roles.staff')}
            </span>
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold mb-2">
            {t('profile.fields.member_since')}
          </p>
          <div className="flex items-center gap-2 text-sm text-brand-ink/60">
            <Calendar size={14} />
            <span>
              {user?.date_joined
                ? new Date(user.date_joined).toLocaleDateString(i18n.language, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : '—'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
