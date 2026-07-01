import { useState, useEffect, useCallback } from 'react';
import { Loader2, Search, Sparkles, ExternalLink, X } from 'lucide-react';
import { motion } from 'motion/react';
import { apiFetch } from '../lib/api';
import { toast } from '@izuna/shared/lib/toast';

interface TrendingLead {
  id: number;
  query: string;
  product_name: string;
  platform: string;
  source_url: string;
  price_info: string;
  status: string;
  created_at: string;
  raw_data?: { why_trending?: string };
}

export default function AiDiscovery() {
  const [query, setQuery] = useState('');
  const [platforms, setPlatforms] = useState(['facebook', 'instagram', 'tiktok']);
  const [searching, setSearching] = useState(false);
  const [leads, setLeads] = useState<TrendingLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);

  const fetchLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      const res = await apiFetch('/trending-leads/');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.results || [];
        setLeads(list.filter((l: TrendingLead) => l.status === 'new'));
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingLeads(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await apiFetch('/ai/discover/', {
        method: 'POST',
        body: JSON.stringify({ query: query.trim(), platforms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      toast.success(`Found ${data.count || 0} trending products`);
      setLeads((prev) => [...(data.leads || []), ...prev]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'AI search failed — check API keys in Settings');
    } finally {
      setSearching(false);
    }
  };

  const dismissLead = async (id: number) => {
    await apiFetch(`/trending-leads/${id}/dismiss/`, { method: 'POST' });
    setLeads((prev) => prev.filter((l) => l.id !== id));
  };

  const togglePlatform = (p: string) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  return (
    <div className="p-8 lg:p-12 max-w-5xl mx-auto space-y-8">
      <div>
        <p className="text-xs font-medium text-brand-red tracking-[0.2em] uppercase mb-2">AI Discovery</p>
        <h1 className="text-4xl font-serif font-bold text-brand-ink">Hot Products on Social</h1>
        <p className="text-sm text-brand-ink/40 mt-2 font-serif italic">
          AI searches Facebook, Instagram, TikTok & web for trending products. Import winners to your catalog.
        </p>
      </div>

      <motion.form
        onSubmit={handleSearch}
        className="bg-white rounded-xl border border-brand-clay p-6 space-y-4"
      >
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/30" size={18} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. cushion foundation japan, skincare trending..."
              className="w-full pl-10 pr-4 py-3 border border-brand-clay rounded-md text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="flex items-center gap-2 px-6 py-3 bg-brand-ink text-white rounded-md text-sm hover:bg-brand-red disabled:opacity-50"
          >
            {searching ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Search
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['facebook', 'instagram', 'tiktok', 'twitter'].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePlatform(p)}
              className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                platforms.includes(p)
                  ? 'bg-brand-red text-white border-brand-red'
                  : 'border-brand-clay text-brand-ink/50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </motion.form>

      {loadingLeads ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-red" />
        </div>
      ) : leads.length === 0 ? (
        <p className="text-center text-brand-ink/40 font-serif italic py-12">No leads yet — run a search above</p>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <div
              key={lead.id}
              className="bg-white rounded-xl border border-brand-clay p-5 flex flex-col sm:flex-row sm:items-start gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase text-brand-red">{lead.platform || 'web'}</span>
                  {lead.query && (
                    <span className="text-xs text-brand-ink/40 truncate">← {lead.query}</span>
                  )}
                </div>
                <h3 className="font-serif font-bold text-brand-ink">{lead.product_name}</h3>
                {lead.price_info && (
                  <p className="text-sm text-brand-ink/70 mt-1">{lead.price_info}</p>
                )}
                {lead.raw_data?.why_trending && (
                  <p className="text-xs text-brand-ink/50 mt-2 italic">{lead.raw_data.why_trending}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                {lead.source_url && (
                  <a
                    href={lead.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 border border-brand-clay rounded-md hover:bg-brand-paper"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
                <button
                  onClick={() => dismissLead(lead.id)}
                  className="p-2 border border-brand-clay rounded-md hover:bg-red-50 text-brand-red"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
