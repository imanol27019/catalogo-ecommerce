import { CATEGORY_LABELS } from '../../config/site.config';

interface CategoryNavProps {
  categories: string[];
  activeCategories: string[];
  onSelect: (category: string) => void;
}

export function CategoryNav({ categories, activeCategories, onSelect }: CategoryNavProps) {
  if (categories.length === 0) return null;

  return (
    <nav className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 sm:justify-center sm:px-6">
        {categories.map((category) => {
          const isActive = activeCategories.length === 1 && activeCategories[0] === category;
          return (
            <a
              key={category}
              href="#catalogo"
              onClick={() => onSelect(category)}
              className={`shrink-0 rounded-full px-4 py-1.5 font-heading text-sm font-medium transition-colors ${
                isActive ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {CATEGORY_LABELS[category] ?? category}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
