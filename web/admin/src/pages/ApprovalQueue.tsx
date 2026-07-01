import { useState, useEffect, useCallback } from 'react';
import { Loader2, Check, X, MessageSquare, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../lib/api';
import { toast } from '@izuna/shared/lib/toast';

interface PendingReply {
  id: number;
  channel: string;
  customer_id: string;
  customer_name: string;
  incoming_message: string;
  draft_reply: string;
  status: string;
  is_greeting: boolean;
  created_at: string;
}

export default function ApprovalQueue() {
  const { t } = useTranslation();
  const [items, setItems] = useState<PendingReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [acting, setActing] = useState<number | null>(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/pending-replies/?status=pending');
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : data.results || []);
      }
    } catch {
      toast.error('Failed to load approval queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 15000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  const handleApprove = async (item: PendingReply) => {
    setActing(item.id);
    try {
      const body = editingId === item.id ? { draft_reply: editText } : {};
      const res = await apiFetch(`/pending-replies/${item.id}/approve/`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Approve failed');
      toast.success('Message sent to customer');
      setEditingId(null);
      fetchPending();
    } catch {
      toast.error('Failed to approve — check chatbot service is running');
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (id: number) => {
    setActing(id);
    try {
      const res = await apiFetch(`/pending-replies/${id}/reject/`, { method: 'POST' });
      if (!res.ok) throw new Error('Reject failed');
      toast.success('Rejected');
      fetchPending();
    } catch {
      toast.error('Failed to reject');
    } finally {
      setActing(null);
    }
  };

  const channelLabel = (ch: string) => {
    if (ch === 'messenger') return 'Messenger';
    if (ch === 'comment') return 'Comment → Inbox';
    if (ch === 'website') return 'Website';
    return ch;
  };

  return (
    <div className="p-8 lg:p-12 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-brand-red tracking-[0.2em] uppercase mb-2">AI Chatbot</p>
          <h1 className="text-4xl font-serif font-bold text-brand-ink">Approval Queue</h1>
          <p className="text-sm text-brand-ink/40 mt-2 font-serif italic">
            Greetings are sent automatically. All other AI replies require your approval before reaching customers.
          </p>
        </div>
        <button
          onClick={fetchPending}
          className="flex items-center gap-2 px-4 py-2 border border-brand-clay rounded-md text-sm hover:bg-brand-paper"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-brand-red" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-brand-ink/40 font-serif italic">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
          No messages waiting for approval
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-brand-clay p-6 space-y-4"
            >
              <div className="flex items-center justify-between text-xs uppercase tracking-wider text-brand-ink/50">
                <span className="font-bold text-brand-red">{channelLabel(item.channel)}</span>
                <span>{new Date(item.created_at).toLocaleString()}</span>
              </div>
              <div className="bg-brand-paper/50 rounded-md p-4">
                <p className="text-xs font-bold text-brand-ink/40 mb-1">Customer</p>
                <p className="text-sm text-brand-ink">{item.incoming_message}</p>
              </div>
              {editingId === item.id ? (
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 border border-brand-clay rounded-md text-sm"
                />
              ) : (
                <div className="bg-white border border-brand-clay rounded-md p-4">
                  <p className="text-xs font-bold text-brand-ink/40 mb-1">AI Draft</p>
                  <p className="text-sm text-brand-ink whitespace-pre-wrap">{item.draft_reply}</p>
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    if (editingId === item.id) {
                      setEditingId(null);
                    } else {
                      setEditingId(item.id);
                      setEditText(item.draft_reply);
                    }
                  }}
                  className="px-4 py-2 text-sm border border-brand-clay rounded-md hover:bg-brand-paper"
                >
                  {editingId === item.id ? 'Cancel edit' : 'Edit'}
                </button>
                <button
                  onClick={() => handleReject(item.id)}
                  disabled={acting === item.id}
                  className="flex items-center gap-2 px-4 py-2 text-sm border border-brand-red/30 text-brand-red rounded-md hover:bg-red-50 disabled:opacity-50"
                >
                  <X size={16} /> Reject
                </button>
                <button
                  onClick={() => handleApprove(item)}
                  disabled={acting === item.id}
                  className="flex items-center gap-2 px-5 py-2 text-sm bg-brand-ink text-white rounded-md hover:bg-brand-red disabled:opacity-50"
                >
                  {acting === item.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Approve & Send
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
