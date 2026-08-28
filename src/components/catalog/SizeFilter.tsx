import { Chip } from '../ui/Chip';

interface SizeFilterProps {
  sizes: string[];
  selected: string[];
  onChange: (sizes: string[]) => void;
}

export function SizeFilter({ sizes, selected, onChange }: SizeFilterProps) {
  function toggle(size: string) {
    onChange(selected.includes(size) ? selected.filter((s) => s !== size) : [...selected, size]);
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-600">Talle</p>
      <div className="flex flex-wrap gap-2">
        {sizes.map((size) => (
          <Chip key={size} isActive={selected.includes(size)} onClick={() => toggle(size)} className="min-w-11">
            {size}
          </Chip>
        ))}
      </div>
    </div>
  );
}
