import React, { createContext, useContext, useMemo } from 'react';
import { INTEGRATION_KEYS, isChatbotEnabledSetting } from '@izuna/shared/lib/integrationSettings';
import { useSettings } from '../hooks/useSettings';

interface ChatbotContextType {
  enabled: boolean;
  loading: boolean;
  refresh: () => Promise<unknown>;
}

const ChatbotContext = createContext<ChatbotContextType | undefined>(undefined);

export function ChatbotProvider({ children }: { children: React.ReactNode }) {
  const { settings, loading, refreshSettings } = useSettings();

  const enabled = useMemo(
    () => isChatbotEnabledSetting(settings[INTEGRATION_KEYS.chatbotEnabled]),
    [settings]
  );

  return (
    <ChatbotContext.Provider value={{ enabled, loading, refresh: refreshSettings }}>
      {children}
    </ChatbotContext.Provider>
  );
}

export function useChatbot() {
  const ctx = useContext(ChatbotContext);
  if (!ctx) {
    throw new Error('useChatbot must be used within ChatbotProvider');
  }
  return ctx;
}
