import { useState, useRef, useEffect, FormEvent } from 'react';
import { Icons } from '../Icons';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (input.trim() && !isLoading) {
      onSend(input.trim());
      setInput('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative max-w-[800px] mx-auto w-full">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Ask about Japanese crafts, artists, or travel..."
        className="w-full pl-4 pr-16 py-4 bg-surface border border-surface-variant rounded-sm focus:outline-none focus:ring-1 focus:ring-secondary/20 resize-none body-md leading-relaxed"
        rows={1}
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={isLoading || !input.trim()}
        className="absolute right-4 bottom-4 p-2 text-secondary disabled:opacity-30 hover:bg-surface-variant rounded-full transition-colors"
      >
        <Icons.Send size={20} />
      </button>
    </form>
  );
}
