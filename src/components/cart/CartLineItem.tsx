import type { CartLineItem as CartLineItemType } from '../../types/cart';
import { computeLineSubtotal, computeLineUnitPrice } from '../../utils/pricing';
import { formatCurrency } from '../../utils/format';
import { QuantityStepper } from '../product/QuantityStepper';
import { TrashIcon } from '../ui/icons';

interface CartLineItemProps {
  item: CartLineItemType;
  onSetQty: (lineId: string, qty: number) => void;
  onAdjustQty: (lineId: string, delta: number) => void;
  onRemove: (lineId: string) => void;
}

export function CartLineItem({ item, onSetQty, onAdjustQty, onRemove }: CartLineItemProps) {
  const unitPrice = computeLineUnitPrice(item);
  const subtotal = computeLineSubtotal(item);

  return (
    <div className="flex gap-3 border-b border-stone-200 pb-4">
      <img src={item.image} alt={item.productName} className="h-20 w-16 shrink-0 rounded-lg object-cover" />
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-stone-900">{item.productName}</p>
            <p className="text-xs text-stone-500">
              Talle {item.size} · {item.color}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(item.lineId)}
            aria-label={`Quitar ${item.productName}`}
            className="text-stone-400 hover:text-red-500"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>

        <QuantityStepper
          qty={item.qty}
          min={item.minQtyPerVariant}
          onIncrement={() => onAdjustQty(item.lineId, 1)}
          onDecrement={() => onAdjustQty(item.lineId, -1)}
          onSetQty={(qty) => onSetQty(item.lineId, qty)}
        />

        <div className="flex items-center justify-between text-sm">
          <span className="text-stone-500">{formatCurrency(unitPrice)} c/u</span>
          <span className="font-semibold text-stone-900">{formatCurrency(subtotal)}</span>
        </div>
      </div>
    </div>
  );
}
