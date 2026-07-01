import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LIST,
  type SocialAccount,
  type SocialPlatformId,
  newSocialAccount,
} from '@izuna/shared/lib/integrationSettings';
import { secretFieldPlaceholder } from '@izuna/shared/lib/secretMask';

type Props = {
  accounts: SocialAccount[];
  onChange: (accounts: SocialAccount[]) => void;
};

export function SocialAccountsSection({ accounts, onChange }: Props) {
  const [addOpen, setAddOpen] = useState(false);

  const updateAccount = (id: string, patch: Partial<SocialAccount>) => {
    onChange(accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const updateCredential = (id: string, key: string, value: string) => {
    onChange(
      accounts.map((a) =>
        a.id === id ? { ...a, credentials: { ...a.credentials, [key]: value } } : a
      )
    );
  };

  const removeAccount = (id: string) => {
    onChange(accounts.filter((a) => a.id !== id));
  };

  const addAccount = (platform: SocialPlatformId) => {
    onChange([...accounts, newSocialAccount(platform)]);
    setAddOpen(false);
  };

  return (
    <div className="space-y-4 pt-4 border-t border-brand-clay">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-brand-ink uppercase tracking-wider">
            Social networks
          </h4>
          <p className="text-xs text-brand-ink/50 italic font-serif mt-1">
            Add each platform you want the chatbot and auto-repost to connect to.
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setAddOpen(!addOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-ink text-white rounded-md text-sm hover:bg-brand-red transition-colors"
          >
            <Plus size={16} />
            Add network
            <ChevronDown size={14} className={addOpen ? 'rotate-180 transition-transform' : ''} />
          </button>
          {addOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-brand-clay rounded-md shadow-lg z-20 py-1 max-h-80 overflow-y-auto">
              {SOCIAL_PLATFORM_LIST.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addAccount(p.id)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-brand-paper transition-colors"
                >
                  <span className="font-semibold text-brand-ink">{p.label}</span>
                  <span className="block text-xs text-brand-ink/40 mt-0.5">{p.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-md border border-dashed border-brand-clay p-8 text-center text-sm text-brand-ink/40 font-serif italic">
          No social accounts yet. Click &quot;Add network&quot; to connect Facebook, Instagram, TikTok, Zalo, LINE…
        </div>
      ) : (
        <div className="space-y-4">
          {accounts.map((account) => {
            const meta = SOCIAL_PLATFORMS[account.platform];
            return (
              <div
                key={account.id}
                className="rounded-lg border border-brand-clay bg-brand-paper/20 p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center gap-3 justify-between">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-red px-2 py-1 bg-white rounded border border-brand-red/20">
                      {meta.label}
                    </span>
                    <input
                      type="text"
                      value={account.label}
                      onChange={(e) => updateAccount(account.id, { label: e.target.value })}
                      placeholder="Display name"
                      className="px-3 py-1.5 border border-brand-clay rounded-md text-sm min-w-[160px]"
                    />
                    <label className="flex items-center gap-2 text-sm text-brand-ink/70 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={account.enabled}
                        onChange={(e) => updateAccount(account.id, { enabled: e.target.checked })}
                        className="rounded border-brand-clay"
                      />
                      Active
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAccount(account.id)}
                    className="p-2 text-brand-red hover:bg-red-50 rounded-md transition-colors"
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <p className="text-xs text-brand-ink/40 italic -mt-2">{meta.description}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {meta.fields.map((field) => (
                    <div
                      key={field.key}
                      className={field.type === 'textarea' ? 'sm:col-span-2' : ''}
                    >
                      <label className="block text-xs font-semibold text-brand-ink mb-1">
                        {field.label}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          value={account.credentials[field.key] || ''}
                          onChange={(e) => updateCredential(account.id, field.key, e.target.value)}
                          rows={2}
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 border border-brand-clay rounded-md text-sm resize-y"
                        />
                      ) : (
                        <input
                          type={field.type}
                          value={account.credentials[field.key] || ''}
                          onChange={(e) => updateCredential(account.id, field.key, e.target.value)}
                          placeholder={
                            field.type === 'password'
                              ? secretFieldPlaceholder(account.credentials[field.key])
                              : field.placeholder
                          }
                          autoComplete="off"
                          className="w-full px-3 py-2 border border-brand-clay rounded-md text-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
