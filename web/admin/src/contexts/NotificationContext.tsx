import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CHAT_API_BASE_URL } from '../lib/env';

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
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem('kizuna_notifications');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) }));
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('kizuna_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    const eventSource = new EventSource(`${CHAT_API_BASE_URL}/notifications/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const newNotification: AppNotification = {
          id: data.id,
          type: data.type,
          title: data.title,
          message: data.message,
          read: false,
          timestamp: new Date(data.timestamp || new Date()),
        };

        setNotifications(prev => [newNotification, ...prev]);
      } catch (error) {
        console.error('Error parsing SSE data', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      // It will auto-reconnect typically, but we can log it
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = useCallback((notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: AppNotification = {
      ...notification,
      id: Math.random().toString(36).substring(2, 9),
      read: false,
      timestamp: new Date(),
    };
    setNotifications(prev => [newNotification, ...prev]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);


  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      clearNotification
    }}>
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
