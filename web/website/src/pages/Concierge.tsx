import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { fade, fadeUp, tweenFast } from '@/lib/motion';
import { MessageItem } from '@/components/concierge/MessageItem';
import { ChatInput } from '@/components/concierge/ChatInput';
import { apiFetch, API_BASE_URL } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function ConciergePage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Chào bạn! Mình là Kizuna AI, chuyên viên tư vấn trực tuyến của shop. Cảm ơn bạn đã ghé thăm. Bạn đang quan tâm hoặc muốn tìm kiếm mặt hàng cụ thể nào, xin vui lòng để lại thông tin để mình có thể hỗ trợ và tư vấn nhanh nhất cho bạn ạ.'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [liveChatAvailable, setLiveChatAvailable] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [sessionId] = useState(() => {
    let sid = localStorage.getItem('concierge_session_id');
    if (!sid) {
      sid = `web_${Date.now()}`;
      localStorage.setItem('concierge_session_id', sid);
    }
    return sid;
  });
  const [adminTookOver, setAdminTookOver] = useState(false);

  useEffect(() => {
    apiFetch('/shop/concierge/live-status/')
      .then((res) => (res.ok ? res.json() : { live: false }))
      .then((data) => setLiveChatAvailable(!!data.live))
      .catch(() => setLiveChatAvailable(false));
  }, []);

  useEffect(() => {
    if (!liveChatAvailable) return;

    const eventSource = new EventSource(
      `${API_BASE_URL}/shop/concierge/stream/${encodeURIComponent(sessionId)}/`
    );
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.is_admin) {
          setAdminTookOver(true);
          setMessages(prev => [...prev, {
            id: data.id,
            role: 'assistant',
            content: data.content
          }]);
        }
      } catch (err) {
        console.error('SSE parse error', err);
      }
    };
    return () => eventSource.close();
  }, [sessionId, liveChatAvailable]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (content: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      let syncToAdmin = liveChatAvailable;
      if (syncToAdmin) {
        const res = await apiFetch('/shop/concierge/message/', {
          method: 'POST',
          body: JSON.stringify({ message: content, session_id: sessionId, sender: 'user' }),
        });
        const data = await res.json();

        if (data.chatbot_disabled) {
          syncToAdmin = false;
          setLiveChatAvailable(false);
        } else if (data.adminTookOver) {
          setAdminTookOver(true);
        }
      }

      if (adminTookOver) {
        setIsLoading(false);
        return;
      }

      const aiRes = await apiFetch('/shop/concierge/reply/', {
        method: 'POST',
        body: JSON.stringify({
          message: content,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!aiRes.ok) {
        throw new Error('Concierge service unavailable');
      }

      const aiData = await aiRes.json();
      const text = aiData.reply;

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: text,
      }]);

      if (syncToAdmin) {
        await apiFetch('/shop/concierge/message/', {
          method: 'POST',
          body: JSON.stringify({ message: text, session_id: sessionId, sender: 'ai' }),
        });
      }

    } catch (err) {
      console.error('Concierge Error:', err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Cảm ơn quý khách đã quan tâm và gửi yêu cầu mua hàng. Shop đã ghi nhận thông tin và sẽ liên hệ lại với quý khách để xác nhận trong thời gian sớm nhất. Xin vui lòng chờ trong giây lát!",
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-surface">
      <div className="text-center py-6 shrink-0">
        <span className="label-sm text-secondary/60 tracking-[0.2em] uppercase">Today</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-4 scroll-smooth">
        <div className="max-w-[800px] mx-auto flex flex-col gap-8 pb-12">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                {...fadeUp}
                transition={tweenFast}
              >
                <MessageItem message={msg} />
              </motion.div>
            ))}
            {isLoading && (
              <motion.div
                {...fade}
                transition={tweenFast}
                className="flex gap-4 items-start"
              >
                <div className="w-8 h-8 rounded-full border border-surface-variant flex items-center justify-center bg-surface">
                  <div className="w-1 h-1 bg-secondary rounded-full animate-pulse" />
                </div>
                <div className="p-4 border border-surface-variant rounded-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-secondary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-secondary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-secondary/40 rounded-full animate-bounce" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="p-8 bg-surface border-t border-surface-variant">
        <ChatInput onSend={handleSend} isLoading={isLoading} />
      </div>
    </div>
  );
}
