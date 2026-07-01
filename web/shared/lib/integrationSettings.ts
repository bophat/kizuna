/** Dynamic social network accounts — stored as JSON in settings key `social_integrations`. */

export const INTEGRATION_KEYS = {
  socialIntegrations: 'social_integrations',
  geminiApiKey: 'gemini_api_key',
  serperApiKey: 'serper_api_key',
  repostEnabled: 'repost_enabled',
  repostPostsPerDay: 'repost_posts_per_day',
  repostDelayMinutes: 'repost_delay_minutes',
  chatbotServiceUrl: 'chatbot_service_url',
  chatbotInternalToken: 'chatbot_internal_token',
  /** @deprecated use social_integrations */
  facebookPageAccessToken: 'facebook_page_access_token',
  facebookVerifyToken: 'facebook_verify_token',
  facebookPageId: 'facebook_page_id',
  facebookGroupIds: 'facebook_group_ids',
} as const;

export type SocialPlatformId =
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'twitter'
  | 'zalo'
  | 'line'
  | 'youtube';

export type FieldType = 'text' | 'password' | 'textarea';

export interface PlatformField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
}

export interface SocialAccount {
  id: string;
  platform: SocialPlatformId;
  label: string;
  enabled: boolean;
  credentials: Record<string, string>;
}

export const SOCIAL_PLATFORMS: Record<
  SocialPlatformId,
  { label: string; description: string; fields: PlatformField[] }
> = {
  facebook: {
    label: 'Facebook',
    description: 'Messenger, comments, fanpage repost to groups',
    fields: [
      { key: 'access_token', label: 'Page Access Token', type: 'password', placeholder: 'EAA...' },
      { key: 'page_id', label: 'Page ID', type: 'text' },
      { key: 'verify_token', label: 'Webhook Verify Token', type: 'text' },
      {
        key: 'group_ids',
        label: 'Group IDs (auto-repost)',
        type: 'textarea',
        placeholder: '["123456","789012"] or comma-separated',
      },
    ],
  },
  instagram: {
    label: 'Instagram',
    description: 'DM & comment automation via Meta Graph API',
    fields: [
      { key: 'access_token', label: 'Access Token', type: 'password' },
      { key: 'account_id', label: 'Instagram Business Account ID', type: 'text' },
    ],
  },
  tiktok: {
    label: 'TikTok',
    description: 'TikTok for Business API',
    fields: [
      { key: 'access_token', label: 'Access Token', type: 'password' },
      { key: 'business_id', label: 'Business ID', type: 'text' },
    ],
  },
  twitter: {
    label: 'X (Twitter)',
    description: 'X API v2',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password' },
      { key: 'api_secret', label: 'API Secret', type: 'password' },
      { key: 'bearer_token', label: 'Bearer Token', type: 'password' },
    ],
  },
  zalo: {
    label: 'Zalo OA',
    description: 'Zalo Official Account',
    fields: [
      { key: 'oa_id', label: 'OA ID', type: 'text' },
      { key: 'secret_key', label: 'Secret Key', type: 'password' },
    ],
  },
  line: {
    label: 'LINE',
    description: 'LINE Messaging API',
    fields: [
      { key: 'channel_token', label: 'Channel Access Token', type: 'password' },
      { key: 'channel_secret', label: 'Channel Secret', type: 'password' },
    ],
  },
  youtube: {
    label: 'YouTube',
    description: 'YouTube Data API',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password' },
      { key: 'channel_id', label: 'Channel ID', type: 'text' },
    ],
  },
};

export const SOCIAL_PLATFORM_LIST = Object.entries(SOCIAL_PLATFORMS).map(([id, meta]) => ({
  id: id as SocialPlatformId,
  ...meta,
}));

export function newSocialAccount(platform: SocialPlatformId): SocialAccount {
  return {
    id: crypto.randomUUID(),
    platform,
    label: SOCIAL_PLATFORMS[platform].label,
    enabled: true,
    credentials: {},
  };
}

export function parseSocialIntegrations(raw: string | undefined): SocialAccount[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((a) => a?.id && a?.platform);
  } catch {
    return [];
  }
}

export function serializeSocialIntegrations(accounts: SocialAccount[]): string {
  return JSON.stringify(accounts, null, 0);
}

/** Migrate legacy flat Facebook keys into social_integrations array. */
export function migrateLegacySocialSettings(settings: Record<string, string>): SocialAccount[] {
  const existing = parseSocialIntegrations(settings[INTEGRATION_KEYS.socialIntegrations]);
  if (existing.length > 0) return existing;

  const token = settings[INTEGRATION_KEYS.facebookPageAccessToken];
  const pageId = settings[INTEGRATION_KEYS.facebookPageId];
  if (!token && !pageId) return [];

  return [
    {
      id: crypto.randomUUID(),
      platform: 'facebook',
      label: 'Facebook (migrated)',
      enabled: true,
      credentials: {
        access_token: token || '',
        page_id: pageId || '',
        verify_token: settings[INTEGRATION_KEYS.facebookVerifyToken] || '',
        group_ids: settings[INTEGRATION_KEYS.facebookGroupIds] || '',
      },
    },
  ];
}
