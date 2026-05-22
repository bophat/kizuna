import { useFormatPrice } from '../../hooks/useFormatPrice';

type ValuationCellProps = {
  amountUsd: number | string;
  className?: string;
};

/** Cột định giá — hiển thị theo ngôn ngữ admin, kèm USD gốc nếu cần */
export function ValuationCell({ amountUsd, className = '' }: ValuationCellProps) {
  const { formatValuation, formatValuationSub } = useFormatPrice();
  const sub = formatValuationSub(amountUsd);

  return (
    <div className={className}>
      <span className="text-sm font-bold text-brand-ink tabular-nums">
        {formatValuation(amountUsd)}
      </span>
      {sub && (
        <span className="block text-[10px] text-brand-ink/40 tabular-nums mt-0.5">{sub}</span>
      )}
    </div>
  );
}
