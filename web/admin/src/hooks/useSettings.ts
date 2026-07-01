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
        data.forEach((s: { key: string; value: string }) => {
          settingsMap[s.key] = s.value;
        });
        setSettings(settingsMap);
        return data as { id: number; key: string; value: string }[];
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
    return [];
  };

  const updateSetting = async (
    key: string,
    value: string,
    existingList?: { id: number; key: string; value: string }[]
  ) => {
    try {
      const data = existingList ?? (await (await apiFetch('/settings/')).json());
      const setting = data.find((s: { key: string }) => s.key === key);

      if (setting) {
        await apiFetch(`/settings/${setting.id}/`, {
          method: 'PATCH',
          body: JSON.stringify({ value }),
        });
      } else {
        const createRes = await apiFetch('/settings/', {
          method: 'POST',
          body: JSON.stringify({ key, value }),
        });
        if (!createRes.ok) {
          const fresh = await (await apiFetch('/settings/')).json();
          const created = fresh.find((s: { key: string }) => s.key === key);
          if (created) {
            await apiFetch(`/settings/${created.id}/`, {
              method: 'PATCH',
              body: JSON.stringify({ value }),
            });
          }
        }
      }
    } catch (error) {
      console.error('Error updating setting:', error);
      throw error;
    }
  };

  const updateSettingsBatch = async (entries: Record<string, string>) => {
    const list = await fetchSettings();
    if (!list.length) {
      list.push(...((await (await apiFetch('/settings/')).json()) as typeof list));
    }
    for (const [key, value] of Object.entries(entries)) {
      await updateSetting(key, value, list);
      const row = list.find((s) => s.key === key);
      if (!row) {
        const fresh = await (await apiFetch('/settings/')).json();
        const created = fresh.find((s: { key: string }) => s.key === key);
        if (created) list.push(created);
      }
    }
    await fetchSettings();
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return { settings, loading, updateSetting, updateSettingsBatch, refreshSettings: fetchSettings };
}
