/** Keys stored in admin Settings → readable via GET /api/shop/settings/ */
export const PUBLIC_CONTENT_KEYS = {
  homeHeroTitle: 'home_hero_title',
  homeHeroSubtitle: 'home_hero_subtitle',
  homeHeroCta: 'home_hero_cta',
  loginHeroText: 'login_hero_text',
  homeHeroImage: 'home_hero_image',
  loginBackgroundImage: 'login_background_image',
} as const;

export type PublicSettingItem = { key: string; value: string };

export function parsePublicSettings(data: unknown): Record<string, string> {
  const items: PublicSettingItem[] = Array.isArray(data)
    ? data
    : (data as { results?: PublicSettingItem[] })?.results ?? [];
  return Object.fromEntries(items.map((s) => [s.key, s.value]));
}

export function contentOrFallback(custom: string | undefined, fallback: string): string {
  const trimmed = custom?.trim();
  return trimmed ? trimmed : fallback;
}
