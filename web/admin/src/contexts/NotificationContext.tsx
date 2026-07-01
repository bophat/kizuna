import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, API_BASE_URL } from '../lib/api';
import { useChatbot } from './ChatbotContext';

export type NotificationType = 'ORDER' | 'CHAT';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  timestamp: Date;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  liveSync: boolean;
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const RETRY_MS = 8000;
const POLL_MS = 20000;

function mergeFeedItems(
  prev: AppNotification[],
  incoming: Array<{
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    timestamp: string;
  }>
): AppNotification[] {
  if (!incoming.length) return prev;
  const byId = new Map(prev.map((n) => [n.id, n]));
  for (const item of incoming) {
    if (byId.has(item.id)) continue;
    byId.set(item.id, {
      id: item.id,
      type: item.type,
      title: item.title,
      message: item.message,
      read: false,
      timestamp: new Date(item.timestamp),
    });
  }
  return Array.from(byId.values()).sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { enabled: chatbotEnabled } = useChatbot();
  const lastErrorRef = useRef<number>(0);
  const activeSourceRef = useRef<EventSource | null>(null);
  const lastPollRef = useRef<string>(
    new Date(Date.now() - 60 * 60 * 1000).toISOString()
  );

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem('kizuna_notifications');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((n: AppNotification & { timestamp: string }) => ({
          ...n,
          timestamp: new Date(n.timestamp),
        }));
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('kizuna_notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Django poll — orders & approvals (always on, no Flask needed)
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const since = encodeURIComponent(lastPollRef.current);
        const res = await apiFetch(`/notifications/feed/?since=${since}`);
        if (!res.ok || cancelled) return;
        const items = await res.json();
        if (Array.isArray(items) && items.length) {
          setNotifications((prev) => mergeFeedItems(prev, items));
        }
        lastPollRef.current = new Date().toISOString();
      } catch {
        /* ignore poll errors */
      }
    };

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Flask SSE — instant chat/order push when live service is on
  useEffect(() => {
    if (!chatbotEnabled) {
      activeSourceRef.current?.close();
      activeSourceRef.current = null;
      return;
    }

    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const connect = async () => {
      if (cancelled) return;

      activeSourceRef.current?.close();
      activeSourceRef.current = null;

      try {
        const ticketRes = await apiFetch('/chat/sse-ticket/', { method: 'POST' });
        if (!ticketRes.ok || cancelled) {
          retryTimer = setTimeout(connect, RETRY_MS);
          return;
        }
        const { ticket, enabled } = await ticketRes.json();
        if (enabled === false || !ticket) {
          return;
        }
        const url = `${API_BASE_URL}/admin/chat/notifications/stream/?ticket=${encodeURIComponent(ticket)}`;
        const eventSource = new EventSource(url);
        activeSourceRef.current = eventSource;

        eventSource.onopen = () => {
          lastErrorRef.current = 0;
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'ERROR') {
              console.warn('[SSE]', data.code, data.message);
              return;
            }
            setNotifications((prev) =>
              mergeFeedItems(prev, [
                {
                  id: data.id,
                  type: data.type,
                  title: data.title,
                  message: data.message,
                  timestamp: data.timestamp || new Date().toISOString(),
                },
              ])
            );
          } catch (error) {
            console.error('Error parsing SSE data', error);
          }
        };

        eventSource.onerror = () => {
          eventSource.close();
          if (activeSourceRef.current === eventSource) {
            activeSourceRef.current = null;
          }
          if (cancelled) return;
          const now = Date.now();
          if (now - lastErrorRef.current < RETRY_MS) return;
          lastErrorRef.current = now;
          retryTimer = setTimeout(connect, RETRY_MS);
        };
      } catch {
        if (!cancelled) {
          retryTimer = setTimeout(connect, RETRY_MS);
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      activeSourceRef.current?.close();
      activeSourceRef.current = null;
    };
  }, [chatbotEnabled]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const addNotification = useCallback((notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: AppNotification = {
      ...notification,
      id: Math.random().toString(36).substring(2, 9),
      read: false,
      timestamp: new Date(),
    };
    setNotifications((prev) => [newNotification, ...prev]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        liveSync: chatbotEnabled,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
