import { getMediaUrl } from './media';

export const IMAGE_WIDTH = {
  thumb: 160,
  card: 480,
  cart: 400,
  detail: 960,
  hero: 1400,
} as const;

export type ImageWidthPreset = keyof typeof IMAGE_WIDTH;

/** Tối ưu URL ảnh ngoài (Unsplash, …) → WebP + resize */
export function optimizeImageUrl(url: string, width: number): string {
  if (!url) return url;

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes('images.unsplash.com')) {
      parsed.searchParams.set('auto', 'format');
      parsed.searchParams.set('fm', 'webp');
      parsed.searchParams.set('w', String(width));
      parsed.searchParams.set('q', '80');
      parsed.searchParams.set('fit', 'crop');
      return parsed.toString();
    }

    if (parsed.hostname.includes('images.pexels.com')) {
      parsed.searchParams.set('auto', 'compress');
      parsed.searchParams.set('cs', 'tinysrgb');
      parsed.searchParams.set('w', String(width));
      return parsed.toString();
    }
  } catch {
    /* relative or invalid URL — return as-is */
  }

  return url;
}

export function getProductImageUrl(
  path: string | null | undefined,
  width: number,
  mediaBase?: string,
  apiBase?: string
): string {
  const resolved = mediaBase
    ? getMediaUrl(path, mediaBase, apiBase)
    : getMediaUrl(path);
  if (!resolved) return '';
  return optimizeImageUrl(resolved, width);
}

export function buildSrcSet(
  path: string | null | undefined,
  widths: number[],
  mediaBase?: string,
  apiBase?: string
): string {
  return widths
    .map((w) => {
      const url = getProductImageUrl(path, w, mediaBase, apiBase);
      return url ? `${url} ${w}w` : null;
    })
    .filter(Boolean)
    .join(', ');
}
