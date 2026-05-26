import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

export function useSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/settings/');
      if (response.ok) {
        const data = await response.json();
        const settingsMap: Record<string, string> = {};
        data.forEach((s: any) => {
          settingsMap[s.key] = s.value;
        });
        setSettings(settingsMap);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: string) => {
    try {
      const response = await apiFetch('/settings/');
      const data = await response.json();
      const setting = data.find((s: any) => s.key === key);
      
      if (setting) {
        await apiFetch(`/settings/${setting.id}/`, {
          method: 'PATCH',
          body: JSON.stringify({ value }),
        });
      } else {
        await apiFetch('/settings/', {
          method: 'POST',
          body: JSON.stringify({ key, value }),
        });
      }
      await fetchSettings();
    } catch (error) {
      console.error('Error updating setting:', error);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return { settings, loading, updateSetting, refreshSettings: fetchSettings };
}
