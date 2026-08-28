import { useState } from 'react';
import type { FilterState, Facets } from '../../utils/filters';
import type { StockStatus } from '../../types/product';
import { STOCK_LABELS } from '../../utils/stock';
import { SearchBox } from './SearchBox';
import { CategoryFilter } from './CategoryFilter';
import { SizeFilter } from './SizeFilter';
import { ColorFilter } from './ColorFilter';
import { PriceRangeFilter } from './PriceRangeFilter';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { FilterIcon } from '../ui/icons';

interface FiltersBarProps {
  filters: FilterState;
  facets: Facets;
  resultCount: number;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
}

const STOCK_STATUSES: StockStatus[] = ['in_stock', 'low_stock', 'out_of_stock'];

export function FiltersBar({ filters, facets, resultCount, onChange, onReset }: FiltersBarProps) {
  const [isPanelOpen, setPanelOpen] = useState(false);

  const activeCount =
    filters.categories.length +
    filters.sizes.length +
    filters.colors.length +
    filters.stockStatuses.length +
    (filters.priceMin != null ? 1 : 0) +
    (filters.priceMax != null ? 1 : 0);

  function toggleStock(status: StockStatus) {
    onChange({
      ...filters,
      stockStatuses: filters.stockStatuses.includes(status)
        ? filters.stockStatuses.filter((s) => s !== status)
        : [...filters.stockStatuses, status],
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex-1">
        <SearchBox value={filters.search} onChange={(search) => onChange({ ...filters, search })} />
      </div>
      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        className="relative flex min-h-11 items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-50"
      >
        <FilterIcon className="h-4 w-4" />
        Filtros
        {activeCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>

      <Drawer
        isOpen={isPanelOpen}
        onClose={() => setPanelOpen(false)}
        title="Filtros"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onReset}>
              Limpiar
            </Button>
            <Button className="flex-1" onClick={() => setPanelOpen(false)}>
              Ver {resultCount} resultado{resultCount === 1 ? '' : 's'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-6">
          <CategoryFilter
            categories={facets.categories}
            selected={filters.categories}
            onChange={(categories) => onChange({ ...filters, categories })}
          />
          <SizeFilter
            sizes={facets.sizes}
            selected={filters.sizes}
            onChange={(sizes) => onChange({ ...filters, sizes })}
          />
          <ColorFilter
            colors={facets.colors}
            selected={filters.colors}
            onChange={(colors) => onChange({ ...filters, colors })}
          />
          <PriceRangeFilter
            min={facets.priceMin}
            max={facets.priceMax}
            valueMin={filters.priceMin}
            valueMax={filters.priceMax}
            onChange={(priceMin, priceMax) => onChange({ ...filters, priceMin, priceMax })}
          />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-600">Disponibilidad</p>
            <div className="flex flex-wrap gap-2">
              {STOCK_STATUSES.map((status) => (
                <Chip
                  key={status}
                  isActive={filters.stockStatuses.includes(status)}
                  onClick={() => toggleStock(status)}
                >
                  {STOCK_LABELS[status]}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
