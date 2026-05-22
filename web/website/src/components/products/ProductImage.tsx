import { cn } from '@/lib/utils';
import { getMediaUrl } from '@/lib/api';
import { MEDIA_BASE_URL } from '@/lib/env';
import {
  buildSrcSet,
  getProductImageUrl,
  IMAGE_WIDTH,
  type ImageWidthPreset,
} from '@izuna/shared/lib/image';

type ProductImageProps = {
  src: string | null | undefined;
  alt: string;
  preset?: ImageWidthPreset;
  width?: number;
  className?: string;
  /** Ảnh LCP (hero / gallery chính) — không lazy */
  priority?: boolean;
  sizes?: string;
};

export function ProductImage({
  src,
  alt,
  preset = 'card',
  width,
  className,
  priority = false,
  sizes,
}: ProductImageProps) {
  const targetWidth = width ?? IMAGE_WIDTH[preset];
  const resolved = getProductImageUrl(src, targetWidth, MEDIA_BASE_URL);

  if (!resolved) {
    return (
      <div
        className={cn('bg-surface-container', className)}
        role="img"
        aria-label={alt}
      />
    );
  }

  const srcSet = buildSrcSet(
    src,
    [targetWidth, Math.round(targetWidth * 1.5)],
    MEDIA_BASE_URL
  );

  const defaultSizes =
    preset === 'detail'
      ? '(max-width: 1024px) 100vw, 50vw'
      : preset === 'thumb'
        ? '80px'
        : preset === 'cart'
          ? '200px'
          : '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px';

  return (
    <img
      src={resolved}
      srcSet={srcSet || undefined}
      sizes={sizes ?? defaultSizes}
      alt={alt}
      width={targetWidth}
      height={Math.round(targetWidth * 1.2)}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      className={cn('object-cover', className)}
    />
  );
}

/** URL đã tối ưu — dùng khi cần `src` string (cache cart, v.v.) */
export function getOptimizedProductImage(
  src: string | null | undefined,
  preset: ImageWidthPreset = 'card'
) {
  return getProductImageUrl(src, IMAGE_WIDTH[preset], MEDIA_BASE_URL) || getMediaUrl(src);
}
