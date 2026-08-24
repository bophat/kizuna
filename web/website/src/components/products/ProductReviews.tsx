import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/Icons';

export interface Review {
  id: number;
  rating: number;
  title: string;
  comment: string;
  author: string;
  is_verified_purchase: boolean;
  created_at: string;
}

/** Read-only star row. `size` is the icon size in px. */
function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={cn(
            star <= Math.round(value)
              ? 'fill-primary text-primary'
              : 'text-outline-variant'
          )}
        />
      ))}
    </span>
  );
}

/** Clickable star row used by the review form. */
function StarPicker({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={String(star)}
          onClick={() => onChange(star)}
          className="p-1 rounded-sm transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Star
            size={26}
            className={cn(
              star <= value ? 'fill-primary text-primary' : 'text-outline-variant'
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function ProductReviews({
  productId,
  ratingAverage,
  reviewCount,
  onReviewSaved,
}: {
  productId: string;
  ratingAverage: number | null;
  reviewCount: number;
  onReviewSaved?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { isAuthenticated } = useAuth();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [existing, setExisting] = useState<Review | null>(null);

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);

  const loadReviews = useCallback(async () => {
    try {
      setLoadError(false);
      const res = await apiFetch(`/shop/products/${productId}/reviews/`);
      if (!res.ok) throw new Error('reviews');
      const data = await res.json();
      setReviews(data.results ?? data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    setLoading(true);
    loadReviews();
  }, [loadReviews]);

  // Whether to offer the form at all is a server decision — it depends on the
  // customer having a delivered order for this product.
  useEffect(() => {
    if (!isAuthenticated) {
      setCanReview(false);
      setExisting(null);
      return;
    }
    let active = true;
    apiFetch(`/shop/products/${productId}/review-eligibility/`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setCanReview(Boolean(data.can_review));
        setExisting(data.existing_review);
        if (data.existing_review) {
          setRating(data.existing_review.rating);
          setTitle(data.existing_review.title || '');
          setComment(data.existing_review.comment || '');
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [productId, isAuthenticated]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (rating < 1) {
      setFormError(t('reviews.rating_required'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch(`/shop/products/${productId}/reviews/`, {
        method: 'POST',
        body: JSON.stringify({ rating, title, comment }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(
          data?.code === 'purchase_required'
            ? t('reviews.purchase_required')
            : t('reviews.error')
        );
        return;
      }
      setExisting(await res.json());
      setSaved(true);
      await loadReviews();
      onReviewSaved?.();
    } catch {
      setFormError(t('reviews.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(iso));

  return (
    <section className="mt-20 pt-14 border-t border-surface-variant">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-8">
        <h2 className="headline-md">{t('reviews.title')}</h2>
        {reviewCount > 0 && (
          <div className="flex items-center gap-3">
            <Stars value={ratingAverage ?? 0} size={18} />
            <span className="font-bold">{(ratingAverage ?? 0).toFixed(1)}</span>
            <span className="text-sm text-secondary">
              {t('reviews.count', { count: reviewCount })}
            </span>
          </div>
        )}
      </div>

      {canReview && (
        <form
          onSubmit={submit}
          className="mb-10 rounded-sm border border-surface-variant bg-surface-container-lowest p-6"
        >
          <h3 className="font-bold mb-4">
            {existing ? t('reviews.edit') : t('reviews.write')}
          </h3>

          <div className="mb-5">
            <p className="label-sm text-secondary mb-2">{t('reviews.your_rating')}</p>
            <StarPicker value={rating} onChange={setRating} label={t('reviews.your_rating')} />
          </div>

          <label className="block mb-4">
            <span className="label-sm text-secondary">{t('reviews.title_label')}</span>
            <input
              type="text"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('reviews.title_placeholder')}
              className="mt-2 w-full rounded-sm border border-surface-variant bg-transparent px-4 py-3 body-md outline-none focus:border-primary"
            />
          </label>

          <label className="block mb-5">
            <span className="label-sm text-secondary">{t('reviews.comment_label')}</span>
            <textarea
              rows={4}
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('reviews.comment_placeholder')}
              className="mt-2 w-full resize-y rounded-sm border border-surface-variant bg-transparent px-4 py-3 body-md outline-none focus:border-primary"
            />
          </label>

          {formError && (
            <div
              role="alert"
              className="mb-4 rounded-sm border border-error bg-error-container px-4 py-3 body-sm text-on-error-container"
            >
              {formError}
            </div>
          )}
          {saved && !formError && (
            <div
              role="status"
              className="mb-4 rounded-sm border border-success bg-success/10 px-4 py-3 body-sm text-success"
            >
              {t('reviews.submitted')}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-8 py-3 label-md text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting && <Icons.Loader2 size={16} className="animate-spin" />}
            {submitting ? t('reviews.submitting') : t('reviews.submit')}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Icons.Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : loadError ? (
        <p className="body-md text-error">{t('reviews.load_error')}</p>
      ) : reviews.length === 0 ? (
        <div className="rounded-sm border border-dashed border-outline-variant px-6 py-10 text-center">
          <p className="body-md text-secondary">{t('reviews.empty')}</p>
          {!isAuthenticated && (
            <p className="body-sm text-secondary mt-2">
              <Link to="/login" className="text-primary hover:underline">
                {t('auth.sign_in')}
              </Link>
              {' — '}
              {t('reviews.empty_cta')}
            </p>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-6">
          {reviews.map((review) => (
            <li key={review.id} className="border-b border-surface-variant pb-6 last:border-b-0">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <Stars value={review.rating} />
                <span className="font-bold text-sm">{review.author}</span>
                {review.is_verified_purchase && (
                  <span className="rounded-sm bg-success/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-success">
                    {t('reviews.verified')}
                  </span>
                )}
                <span className="text-xs text-secondary">{formatDate(review.created_at)}</span>
              </div>
              {review.title && <p className="font-medium mb-1">{review.title}</p>}
              {review.comment && (
                <p className="body-md text-secondary whitespace-pre-line">{review.comment}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
