import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { APP_URL } from '@/lib/env';

export const SITE_NAME = 'KIZUNA';

/** Ảnh mặc định dùng cho Open Graph / Twitter card khi trang không có ảnh riêng. */
export const DEFAULT_OG_IMAGE =
  'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=2070&auto=format&fit=crop';

/**
 * APP_URL rỗng khi chưa gắn domain chính thức (xem VITE_APP_URL trong .env).
 * Khi đó ta bỏ qua canonical / og:url thay vì trỏ sai domain — an toàn hơn là đoán bậy.
 */
const absoluteUrl = (path: string) => (APP_URL ? `${APP_URL}${path.startsWith('/') ? path : `/${path}`}` : '');

export interface SEOProps {
  /** Tiêu đề trang. Tự động nối " | KIZUNA" trừ khi title đã chứa tên site. */
  title: string;
  description?: string;
  /** Đường dẫn tương đối (vd "/collections") — dùng để build canonical & og:url. */
  path?: string;
  image?: string;
  /** Đặt true cho các trang riêng tư / thin content (giỏ hàng, tài khoản, 404...) */
  noindex?: boolean;
  type?: 'website' | 'product' | 'article';
  /** JSON-LD structured data (vd schema.org/Product) — inject dạng <script type="application/ld+json"> */
  jsonLd?: Record<string, unknown>;
}

export function SEO({
  title,
  description,
  path,
  image,
  noindex = false,
  type = 'website',
  jsonLd,
}: SEOProps) {
  const { i18n } = useTranslation();
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const url = path ? absoluteUrl(path) : '';
  const ogImage = image || DEFAULT_OG_IMAGE;
  const robots = noindex ? 'noindex, nofollow' : 'index, follow';

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <meta name="robots" content={robots} />
      {url && <link rel="canonical" href={url} />}

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:image" content={ogImage} />
      {url && <meta property="og:url" content={url} />}
      <meta property="og:locale" content={i18n.language?.startsWith('ja') ? 'ja_JP' : i18n.language?.startsWith('vi') ? 'vi_VN' : 'en_US'} />

      {/* Twitter card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={ogImage} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
