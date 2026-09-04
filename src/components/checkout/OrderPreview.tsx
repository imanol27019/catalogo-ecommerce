import type { CartLineItem, CartTotals } from '../../types/cart';
import { computeLineSubtotal } from '../../utils/pricing';
import { formatCurrency } from '../../utils/format';

interface OrderPreviewProps {
  items: CartLineItem[];
  totals: CartTotals;
}

export function OrderPreview({ items, totals }: OrderPreviewProps) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-600">Resumen del pedido</p>
      <ul className="flex flex-col gap-1.5 text-sm">
        {items.map((item) => (
          <li key={item.lineId} className="flex items-center justify-between gap-2">
            <span className="text-stone-700">
              {item.qty}x {item.productName} ({item.size}/{item.color})
            </span>
            <span className="shrink-0 font-medium text-stone-900">{formatCurrency(computeLineSubtotal(item))}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t border-stone-200 pt-2 text-sm font-bold text-stone-900">
        <span>Total</span>
        <span>{formatCurrency(totals.grandTotal)}</span>
      </div>
    </div>
  );
}
