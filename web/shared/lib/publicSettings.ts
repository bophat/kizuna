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
export type PublicContentLanguage = 'en' | 'ja' | 'vi';

export function normalizeContentLanguage(language: string | undefined): PublicContentLanguage {
  const base = language?.split('-')[0];
  return base === 'ja' || base === 'vi' ? base : 'en';
}

export function localizedContentKey(key: string, language: string | undefined): string {
  return `${key}_${normalizeContentLanguage(language)}`;
}

export function inferContentLanguage(value: string): PublicContentLanguage {
  if (/[ぁ-んァ-ン一-龯]/u.test(value)) return 'ja';
  if (/[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu.test(value)) {
    return 'vi';
  }
  return 'en';
}

export function localizedContentValue(
  settings: Record<string, string>,
  key: string,
  language: string | undefined,
): string | undefined {
  const normalizedLanguage = normalizeContentLanguage(language);
  const localized = settings[localizedContentKey(key, normalizedLanguage)];
  if (localized) return localized;

  const legacy = settings[key];
  return legacy && inferContentLanguage(legacy) === normalizedLanguage ? legacy : undefined;
}

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
