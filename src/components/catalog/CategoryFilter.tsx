import { CATEGORY_LABELS } from '../../config/site.config';
import { Chip } from '../ui/Chip';

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
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-600">Categoría</p>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Chip key={category} isActive={selected.includes(category)} onClick={() => toggle(category)}>
            {CATEGORY_LABELS[category] ?? category}
          </Chip>
        ))}
      </div>
    </div>
  );
}
