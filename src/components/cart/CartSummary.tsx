import type { CartTotals } from '../../types/cart';
import { formatCurrency } from '../../utils/format';

export function CartSummary({ totals }: { totals: CartTotals }) {
  return (
    <div className="flex items-center justify-between text-base">
      <span className="font-semibold text-stone-700">Total ({totals.itemCount} u.)</span>
      <span className="font-heading text-lg font-semibold text-brand-600">{formatCurrency(totals.grandTotal)}</span>
    </div>
  );
}
