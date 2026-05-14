import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MessageItem } from '@/components/concierge/MessageItem';
import { ChatInput } from '@/components/concierge/ChatInput';

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
      content: 'Welcome to Takumi Artisan Concierge. I am Kenji. How may I assist you in your pursuit of craftsmanship today?' 
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      // Note: In Vite, use import.meta.env.VITE_...
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      
      if (!apiKey) {
        throw new Error('Gemini API Key is not configured. Please add VITE_GEMINI_API_KEY to your .env file.');
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        systemInstruction: "You are Kenji, an expert Japanese artisan concierge for 'KIZUNA'. You are sophisticated, polite, and deeply knowledgeable about Japanese traditional crafts like Kintsugi, Hinoki woodwork, Ceramics, and Textiles. You specialize in bespoke requests. Keep your tone serene and premium."
      });
      
      const chatHistory = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const chat = model.startChat({
        history: chatHistory,
      });

      const result = await chat.sendMessage(content);
      const response = await result.response;
      const text = response.text();

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: text,
      }]);
    } catch (err) {
      console.error('Concierge Error:', err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I apologize, but I am experiencing difficulties connecting with our artisans at the moment. Please try again shortly.",
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <MessageItem message={msg} />
              </motion.div>
            ))}
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
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
