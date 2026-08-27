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
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Talle</p>
      <div className="flex flex-wrap gap-2">
        {sizes.map((size) => {
          const isActive = selected.includes(size);
          return (
            <button
              key={size}
              type="button"
              onClick={() => toggle(size)}
              className={`min-w-10 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'
              }`}
            >
              {size}
            </button>
          );
        })}
      </div>
    </div>
  );
}
