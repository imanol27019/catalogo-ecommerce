import { CATEGORY_LABELS } from '../../config/site.config';

interface CategoryNavProps {
  categories: string[];
  activeCategories: string[];
  onSelect: (category: string) => void;
}

export function CategoryNav({ categories, activeCategories, onSelect }: CategoryNavProps) {
  if (categories.length === 0) return null;

  return (
    // El scroll va en un contenedor propio y con `min-w-0`, para que muchas categorías no
    // terminen ensanchando la página entera.
    <nav aria-label="Categorías" className="w-full min-w-0 border-b border-stone-200 bg-white">
      <div className="mx-auto max-w-6xl overflow-x-auto px-4 py-2 sm:px-6">
        <div className="flex gap-2 sm:justify-center">
          {categories.map((category) => {
            const isActive = activeCategories.length === 1 && activeCategories[0] === category;
            return (
              // Es navegación (ancla al catálogo), no un control de formulario: por eso no usa
              // el componente Chip, pero comparte su medida táctil.
              <a
                key={category}
                href="#catalogo"
                aria-current={isActive ? 'true' : undefined}
                onClick={() => onSelect(category)}
                className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 font-heading text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {CATEGORY_LABELS[category] ?? category}
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
