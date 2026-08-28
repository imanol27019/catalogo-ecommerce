import { INPUT_CLASS } from '../ui/formStyles';
interface PriceRangeFilterProps {
  min: number;
  max: number;
  valueMin?: number;
  valueMax?: number;
  onChange: (min: number | undefined, max: number | undefined) => void;
}

export function PriceRangeFilter({ min, max, valueMin, valueMax, onChange }: PriceRangeFilterProps) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Precio unitario</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder={String(min)}
          value={valueMin ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined, valueMax)}
          className={INPUT_CLASS}
        />
        <span className="shrink-0 text-stone-500">–</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder={String(max)}
          value={valueMax ?? ''}
          onChange={(e) => onChange(valueMin, e.target.value ? Number(e.target.value) : undefined)}
          className={INPUT_CLASS}
        />
      </div>
    </div>
  );
}
