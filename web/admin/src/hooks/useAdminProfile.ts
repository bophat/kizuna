import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../lib/api';
import { toast } from '@izuna/shared/lib/toast';

export interface ProfileFormData {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
}

export function useAdminProfile() {
  const { t } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
  });

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/me/');
      if (response.ok) {
        const data = await response.json();
        setUser(data);
        setFormData({
          username: data.username || '',
          email: data.email || '',
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          phone: data.profile?.phone || '',
          address: data.profile?.address || '',
        });
        if (data.avatar_url) setAvatarPreview(data.avatar_url);
      } else {
        toast.error(t('profile.error_load'));
      }
    } catch {
      toast.error(t('common.error_occurred'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await apiFetch('/me/', {
        method: 'PATCH',
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          first_name: formData.first_name,
          last_name: formData.last_name,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || t('profile.errors.update_failed'));
      }

      let updatedUser = await response.json();

      if (avatarFile) {
        const formDataAvatar = new FormData();
        formDataAvatar.append('avatar', avatarFile);
        const avatarResponse = await apiFetch('/me/avatar/', {
          method: 'POST',
          body: formDataAvatar,
        });
        if (!avatarResponse.ok) throw new Error(t('profile.errors.avatar_failed'));
        const avatarData = await avatarResponse.json();
        updatedUser.avatar_url = avatarData.avatar_url;
      }

      setUser(updatedUser);
      toast.success(t('profile.save_success'));
      setAvatarFile(null);
    } catch (err: any) {
      toast.error(err.message || t('profile.save_error'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm(t('profile.logout_confirm'))) {
      await apiFetch('/logout/', { method: 'POST' });
      window.location.href = '/login';
    }
  };

  return {
    user,
    loading,
    saving,
    avatarPreview,
    formData,
    setFormData,
    fetchProfile,
    handleAvatarChange,
    handleSubmit,
    handleLogout,
  };
}
