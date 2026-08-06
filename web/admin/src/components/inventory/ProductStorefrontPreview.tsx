import { Eye, Heart, ImageOff, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ProductFormData } from '../../features/inventory/types';
import { getMediaUrl } from '../../lib/api';
import { cn } from '../../lib/utils';
import { useFormatPrice } from '../../hooks/useFormatPrice';

export type PreviewLanguage = 'default' | 'en' | 'ja' | 'vi';

interface ProductStorefrontPreviewProps {
  formData: ProductFormData;
  categories: any[];
  previewUrl: string | null;
  language: PreviewLanguage;
  onLanguageChange: (language: PreviewLanguage) => void;
}

const PREVIEW_LANGUAGES: PreviewLanguage[] = ['default', 'en', 'ja', 'vi'];

function localizedValue(
  formData: ProductFormData,
  field: 'name' | 'description',
  language: PreviewLanguage,
) {
  if (language !== 'default') {
    const translated = String(formData[`${field}_${language}`] || '').trim();
    if (translated) return translated;
  }
  return String(formData[field] || '').trim();
}

export function ProductStorefrontPreview({
  formData,
  categories,
  previewUrl,
  language,
  onLanguageChange,
}: ProductStorefrontPreviewProps) {
  const { t } = useTranslation();
  const { format: formatPrice } = useFormatPrice();
  const name = localizedValue(formData, 'name', language)
    || t('inventory.modal.preview_unnamed');
  const description = localizedValue(formData, 'description', language)
    || t('inventory.modal.preview_no_description');
  const category = categories.find(
    (item) => String(item.id) === String(formData.category),
  );
  const categoryName = category?.name || t('inventory.modal.preview_uncategorized');
  const image = previewUrl ? getMediaUrl(previewUrl) : '';
  const numericStock = Math.max(Number.parseInt(formData.stock || '0', 10) || 0, 0);

  const badges = [
    formData.is_new && t('inventory.modal.attributes.new'),
    formData.is_featured && t('inventory.modal.attributes.featured'),
    formData.is_limited && t('inventory.modal.attributes.limited'),
    formData.is_cheap && t('inventory.modal.attributes.cheap'),
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-brand-clay bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-brand-red">
            <Eye size={18} />
            <h3 className="font-serif text-xl font-bold">
              {t('inventory.modal.preview_title')}
            </h3>
          </div>
          <p className="mt-1 text-xs text-brand-ink/45">
            {t('inventory.modal.preview_help')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PREVIEW_LANGUAGES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onLanguageChange(item)}
              className={cn(
                'rounded-sm border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors',
                language === item
                  ? 'border-brand-red bg-brand-red text-white'
                  : 'border-brand-clay bg-white text-brand-ink/50 hover:border-brand-red',
              )}
            >
              {t(`inventory.modal.languages.${item}`)}
            </button>
          ))}
        </div>
      </div>

      {formData.status !== 'published' && (
        <div className="rounded-sm border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          {t('inventory.modal.preview_status_warning', {
            status: t(`inventory.status.${formData.status}`),
          })}
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[300px_minmax(0,1fr)]">
        <section>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-ink/40">
            {t('inventory.modal.preview_card')}
          </p>
          <article className="flex h-full max-h-[500px] min-h-[440px] flex-col overflow-hidden rounded-sm border border-brand-clay bg-white shadow-sm">
            <div className="relative aspect-square shrink-0 overflow-hidden bg-brand-paper">
              {image ? (
                <img
                  src={image}
                  alt={name}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-contain object-center"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-brand-ink/20">
                  <ImageOff size={44} strokeWidth={1.2} />
                </div>
              )}
              {badges.length > 0 && (
                <div className="absolute left-3 top-3 flex max-w-[70%] flex-wrap gap-1.5">
                  {badges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-sm bg-brand-red px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex min-h-[140px] flex-1 flex-col p-5">
              <p className="truncate text-[10px] font-medium uppercase tracking-[0.2em] text-brand-ink/45">
                {categoryName}
              </p>
              <h4 title={name} className="mt-1 min-h-[3rem] line-clamp-2 text-lg font-medium leading-6">
                {name}
              </h4>
              <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                <strong className="truncate text-base">{formatPrice(formData.price || 0)}</strong>
                <span className="shrink-0 text-[10px] italic text-brand-ink/45">
                  {t('inventory.modal.preview_stock', { count: numericStock })}
                </span>
              </div>
            </div>
          </article>
        </section>

        <section>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-ink/40">
            {t('inventory.modal.preview_detail')}
          </p>
          <div className="grid min-h-[440px] overflow-hidden rounded-lg border border-brand-clay bg-white lg:grid-cols-2">
            <div className="flex min-h-[320px] items-center justify-center bg-brand-paper p-6">
              {image ? (
                <img
                  src={image}
                  alt={name}
                  referrerPolicy="no-referrer"
                  className="h-full max-h-[480px] w-full object-contain object-center"
                />
              ) : (
                <Package size={72} strokeWidth={1} className="text-brand-ink/15" />
              )}
            </div>
            <div className="flex min-w-0 flex-col p-6 lg:p-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-red">
                {formData.brand || categoryName}
              </p>
              <h4 className="mt-3 break-words font-serif text-2xl font-bold leading-tight">
                {name}
              </h4>
              <strong className="mt-5 text-2xl">{formatPrice(formData.price || 0)}</strong>
              <p className="mt-6 whitespace-pre-line break-words text-sm leading-7 text-brand-ink/65">
                {description}
              </p>
              <dl className="mt-auto grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-brand-clay pt-5 text-xs">
                <dt className="text-brand-ink/40">{t('inventory.modal.brand_label')}</dt>
                <dd className="min-w-0 truncate font-medium">{formData.brand || '—'}</dd>
                <dt className="text-brand-ink/40">{t('inventory.modal.location_label')}</dt>
                <dd className="min-w-0 truncate font-medium">{formData.location || '—'}</dd>
                <dt className="text-brand-ink/40">{t('inventory.modal.weight_label')}</dt>
                <dd className="font-medium">{formData.weight ? `${formData.weight} kg` : '—'}</dd>
              </dl>
              <div className="mt-5 flex items-center gap-2 rounded-sm bg-brand-ink px-4 py-3 text-xs font-bold text-white">
                <Heart size={16} />
                {t('inventory.modal.preview_storefront_action')}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
