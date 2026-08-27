import { CATEGORY_LABELS } from '../../config/site.config';

interface CategoryFilterProps {
  categories: string[];
  selected: string[];
  onChange: (categories: string[]) => void;
}

export function CategoryFilter({ categories, selected, onChange }: CategoryFilterProps) {
  function toggle(category: string) {
    onChange(selected.includes(category) ? selected.filter((c) => c !== category) : [...selected, category]);
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Categoría</p>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const isActive = selected.includes(category);
          return (
            <button
              key={category}
              type="button"
              onClick={() => toggle(category)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'
              }`}
            >
              {CATEGORY_LABELS[category] ?? category}
            </button>
          );
        })}
      </div>
    </div>
  );
}
