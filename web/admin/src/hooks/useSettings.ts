import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../lib/api';

export function useSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const settingsListRef = useRef<{ id: number; key: string; value: string }[]>([]);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/settings/');
      if (response.ok) {
        const data = await response.json();
        settingsListRef.current = data;
        const settingsMap: Record<string, string> = {};
        data.forEach((s: { key: string; value: string }) => {
          settingsMap[s.key] = s.value;
        });
        setSettings(settingsMap);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const upsertSetting = async (key: string, value: string, list = settingsListRef.current) => {
    let setting = list.find((s) => s.key === key);

    if (setting) {
      const res = await apiFetch(`/settings/${setting.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error(`Failed to update ${key}`);
      return;
    }

    const createRes = await apiFetch('/settings/', {
      method: 'POST',
      body: JSON.stringify({ key, value }),
    });

    if (createRes.ok) return;

    if (createRes.status === 400) {
      const refresh = await apiFetch('/settings/');
      if (!refresh.ok) throw new Error(`Failed to create ${key}`);
      const refreshed = await refresh.json();
      settingsListRef.current = refreshed;
      setting = refreshed.find((s: { key: string }) => s.key === key);
      if (setting) {
        const res = await apiFetch(`/settings/${setting.id}/`, {
          method: 'PATCH',
          body: JSON.stringify({ value }),
        });
        if (!res.ok) throw new Error(`Failed to update ${key}`);
        return;
      }
    }

    throw new Error(`Failed to save ${key}`);
  };

  const updateSetting = async (key: string, value: string, options?: { refresh?: boolean }) => {
    try {
      await upsertSetting(key, value);
      if (options?.refresh !== false) {
        await fetchSettings();
      }
    } catch (error) {
      console.error('Error updating setting:', error);
      throw error;
    }
  };

  const updateSettings = async (entries: Record<string, string>) => {
    let list = settingsListRef.current;
    const refreshRes = await apiFetch('/settings/');
    if (refreshRes.ok) {
      list = await refreshRes.json();
      settingsListRef.current = list;
    }

    for (const [key, value] of Object.entries(entries)) {
      await upsertSetting(key, value, list);
      const item = list.find((s) => s.key === key);
      if (!item) {
        const r = await apiFetch('/settings/');
        if (r.ok) {
          list = await r.json();
          settingsListRef.current = list;
        }
      }
    }

    await fetchSettings();
  };

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, updateSetting, updateSettings, refreshSettings: fetchSettings };
}
