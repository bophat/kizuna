import { Icons } from '../Icons';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function MessageItem({ message }: { message: Message }) {
  return (
    <div
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] flex gap-4 ${
          message.role === 'user' ? 'flex-row-reverse' : ''
        }`}
      >
        <div className="flex-shrink-0 w-8 h-8 rounded-full border border-surface-variant flex items-center justify-center bg-surface">
          {message.role === 'assistant' ? (
            <Icons.Sparkles size={14} className="text-secondary" />
          ) : (
            <Icons.User size={14} className="text-secondary" />
          )}
        </div>
        <div
          className={`p-4 rounded-sm ${
            message.role === 'user'
              ? 'bg-surface-variant'
              : 'border border-surface-variant'
          }`}
        >
          <p className="body-md whitespace-pre-wrap leading-relaxed">
            {message.content}
          </p>
        </div>
      </div>
    </div>
  );
}
