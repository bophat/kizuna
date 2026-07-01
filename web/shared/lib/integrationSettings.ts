/** Admin-only integration keys (never expose via public settings API). */
export const INTEGRATION_KEYS = {
  facebookPageAccessToken: 'facebook_page_access_token',
  facebookVerifyToken: 'facebook_verify_token',
  facebookPageId: 'facebook_page_id',
  geminiApiKey: 'gemini_api_key',
  serperApiKey: 'serper_api_key',
  facebookGroupIds: 'facebook_group_ids',
  repostEnabled: 'repost_enabled',
  repostPostsPerDay: 'repost_posts_per_day',
  repostDelayMinutes: 'repost_delay_minutes',
  chatbotServiceUrl: 'chatbot_service_url',
  chatbotInternalToken: 'chatbot_internal_token',
} as const;

export type IntegrationKey = (typeof INTEGRATION_KEYS)[keyof typeof INTEGRATION_KEYS];
