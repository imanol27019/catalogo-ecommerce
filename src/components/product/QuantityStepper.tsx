import { MinusIcon, PlusIcon } from '../ui/icons';

interface QuantityStepperProps {
  qty: number;
  min: number;
  /** Deltas van por callback dedicado (no `qty ± 1`) para no perder clicks si llegan antes del re-render. */
  onIncrement: () => void;
  onDecrement: () => void;
  onSetQty: (qty: number) => void;
  disabled?: boolean;
}

export function QuantityStepper({ qty, min, onIncrement, onDecrement, onSetQty, disabled }: QuantityStepperProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled || qty <= 1}
          onClick={onDecrement}
          aria-label="Restar unidad"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-stone-300 text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MinusIcon className="h-4 w-4" />
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={qty}
          disabled={disabled}
          onChange={(e) => onSetQty(Math.max(1, Number(e.target.value) || 1))}
          className="min-h-11 w-14 rounded-lg border border-stone-300 text-center text-sm font-semibold focus:border-brand-500"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={onIncrement}
          aria-label="Sumar unidad"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-stone-300 text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>
      {qty < min && <span className="text-xs font-medium text-stock-low">Mínimo sugerido: {min} u.</span>}
    </div>
  );
}
