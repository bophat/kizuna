import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, User, Bot, AlertCircle, MessageCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { apiFetch } from '../lib/api';
import { useChatbot } from '../contexts/ChatbotContext';
import { Link } from 'react-router-dom';
import { Settings as SettingsIcon } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  is_admin?: boolean;
  timestamp: number;
}

interface ChatSession {
  messages: ChatMessage[];
  adminTookOver: boolean;
  updated_at: number;
}

export default function Chat() {
  const { t } = useTranslation();
  const { enabled: chatbotEnabled } = useChatbot();
  const [sessions, setSessions] = useState<Record<string, ChatSession>>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchSessions = async () => {
    try {
      const res = await apiFetch('/chat/sessions/');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (e) {
      console.error('Failed to fetch chat sessions', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!chatbotEnabled) {
      setIsLoading(false);
      return;
    }
    fetchSessions();
    const interval = setInterval(fetchSessions, 3000);
    return () => clearInterval(interval);
  }, [chatbotEnabled]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sessions, activeSessionId]);

  if (!chatbotEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 p-8 text-center">
        <MessageCircle className="w-12 h-12 text-brand-ink/20" />
        <h2 className="text-xl font-serif font-bold text-brand-ink">Chatbot is turned off</h2>
        <p className="text-sm text-brand-ink/50 max-w-md">
          Enable the chatbot in Settings → Integrations when Flask service is running.
          This avoids connection errors while the service is offline.
        </p>
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-white rounded-md text-sm hover:bg-brand-red transition-colors"
        >
          <SettingsIcon size={16} />
          Open Settings
        </Link>
      </div>
    );
  }

  const activeSession = activeSessionId ? sessions[activeSessionId] : null;
  const sessionCount = Object.keys(sessions).length;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeSessionId) return;

    setIsSending(true);
    try {
      const res = await apiFetch(`/chat/${activeSessionId}/reply/`, {
        method: 'POST',
        body: JSON.stringify({ message: input.trim() }),
      });
      if (res.ok) {
        setInput('');
        await fetchSessions();
      }
    } catch (e) {
      console.error('Failed to send reply', e);
    } finally {
      setIsSending(false);
    }
  };

  const formatCustomerId = (id: string) => id.split('_')[1] || id;

  return (
    <div className="ma-spacing space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <p className="text-xs font-medium text-brand-red tracking-[0.2em] uppercase mb-2">
            {t('chat.subtitle')}
          </p>
          <h1 className="text-4xl font-serif font-bold text-brand-ink">{t('chat.title')}</h1>
          <p className="text-brand-ink/40 font-serif italic mt-2 text-sm md:text-base">
            {t('chat.description')}
          </p>
        </div>
        <div className="bg-white px-6 py-3 rounded-lg border border-brand-clay shadow-sm text-center min-w-[140px]">
          <p className="text-[10px] uppercase text-brand-ink/40 font-bold mb-1 tracking-widest">
            {t('chat.active_sessions')}
          </p>
          <p className="text-2xl font-serif font-bold text-brand-red">{sessionCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-brand-clay shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[560px] h-[calc(100vh-18rem)] max-h-[800px]">
        {/* Session list */}
        <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-brand-clay flex flex-col shrink-0">
          <div className="p-4 border-b border-brand-clay bg-brand-paper/30">
            <div className="flex items-center gap-2 text-brand-ink/50">
              <MessageCircle size={16} className="text-brand-red" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold">
                {t('chat.sessions_title')}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-brand-red" />
                <p className="text-sm font-serif italic text-brand-ink/40">{t('chat.loading')}</p>
              </div>
            ) : sessionCount === 0 ? (
              <div className="p-8 text-center text-brand-ink/40 text-sm font-serif italic">
                {t('chat.no_sessions')}
              </div>
            ) : (
              Object.entries(sessions)
                .sort(([, a], [, b]) => b.updated_at - a.updated_at)
                .map(([id, session]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveSessionId(id)}
                    className={cn(
                      'w-full text-left p-4 border-b border-brand-clay/50 transition-all',
                      activeSessionId === id
                        ? 'bg-brand-red/5 border-l-4 border-l-brand-red'
                        : 'hover:bg-brand-paper/50 border-l-4 border-l-transparent'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-sm bg-brand-red/10 flex items-center justify-center text-brand-red shrink-0">
                        <User size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-brand-ink truncate">
                          {t('chat.customer_label', { id: formatCustomerId(id) })}
                        </h3>
                        <p className="text-xs text-brand-ink/50 truncate mt-1 font-serif italic">
                          {session.messages[session.messages.length - 1]?.content || t('chat.no_messages')}
                        </p>
                      </div>
                      {session.adminTookOver && (
                        <span className="text-[10px] font-bold bg-brand-ink text-white px-2 py-1 rounded-sm shrink-0">
                          {t('chat.admin_badge')}
                        </span>
                      )}
                    </div>
                  </button>
                ))
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div className="flex-1 flex flex-col min-w-0 bg-brand-paper/20">
          {activeSessionId && activeSession ? (
            <>
              <div className="p-4 bg-white border-b border-brand-clay flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-sm bg-brand-red/10 flex items-center justify-center text-brand-red shrink-0">
                    <User size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-serif font-bold text-lg text-brand-ink truncate">
                      {t('chat.session_title', { id: activeSessionId })}
                    </h3>
                    <p className="text-xs text-brand-ink/50 font-serif italic">
                      {activeSession.adminTookOver
                        ? t('chat.status_admin')
                        : t('chat.status_ai')}
                    </p>
                  </div>
                </div>
                {!activeSession.adminTookOver && (
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-sm shrink-0">
                    <Bot size={14} />
                    {t('chat.ai_handling')}
                  </div>
                )}
              </div>

              <div
                className="flex-1 overflow-y-auto p-6 flex flex-col gap-4"
                ref={scrollRef}
              >
                {activeSession.messages.map((msg, i) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={msg.id || i}
                      className={cn(
                        'flex gap-3 max-w-[85%]',
                        isUser ? 'justify-start self-start' : 'justify-end self-end ml-auto'
                      )}
                    >
                      {isUser && (
                        <div className="w-8 h-8 rounded-sm bg-brand-red/10 flex items-center justify-center text-brand-red shrink-0 mt-1">
                          <User size={14} />
                        </div>
                      )}
                      <div
                        className={cn(
                          'p-4 rounded-sm text-sm',
                          isUser
                            ? 'bg-white border border-brand-clay text-brand-ink'
                            : msg.is_admin
                              ? 'bg-brand-ink text-white'
                              : 'bg-brand-red/10 text-brand-ink border border-brand-red/10'
                        )}
                      >
                        {!isUser && !msg.is_admin && (
                          <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-brand-red/70 mb-1 tracking-widest">
                            <Bot size={12} />
                            {t('chat.ai_reply')}
                          </div>
                        )}
                        {!isUser && msg.is_admin && (
                          <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-white/70 mb-1 tracking-widest">
                            <AlertCircle size={12} />
                            {t('chat.admin_reply')}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 bg-white border-t border-brand-clay shrink-0">
                <form onSubmit={handleSend} className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      activeSession.adminTookOver
                        ? t('chat.input_admin')
                        : t('chat.input_takeover')
                    }
                    className="flex-1 bg-brand-paper border border-brand-clay rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red transition-all"
                    disabled={isSending}
                  />
                  <button
                    type="submit"
                    disabled={isSending || !input.trim()}
                    className="bg-brand-ink text-white px-5 rounded-md flex items-center justify-center hover:bg-brand-red transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSending ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Send size={18} />
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-brand-ink/30 gap-4 p-8">
              <Bot size={48} strokeWidth={1} className="opacity-30" />
              <p className="font-serif italic text-lg text-brand-ink/40">{t('chat.select_session')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
