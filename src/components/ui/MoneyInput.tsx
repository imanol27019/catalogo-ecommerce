import { INPUT_COMPACT_CLASS } from './formStyles';

/** Campo de pesos: solo enteros, y vacío en vez de un 0 que hay que borrar antes de escribir. */
export function MoneyInput({
  value,
  onChange,
  ariaLabel,
  className = '',
}: {
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-stone-600">
        $
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={value === 0 ? '' : value}
        placeholder="0"
        onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
        aria-label={ariaLabel}
        className={`${INPUT_COMPACT_CLASS} w-full pl-6`}
      />
    </div>
  );
}
