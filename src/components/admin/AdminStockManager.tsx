import { useMemo, useState } from 'react';
import type { Product } from '../../types/product';
import { CATEGORY_LABELS } from '../../config/site.config';
import { settings } from '../../data/settings';
import { deriveStockStatus, STOCK_LABELS } from '../../utils/stock';

interface AdminStockManagerProps {
  products: Product[];
  onChange: (products: Product[]) => void;
}

type StockFilter = 'all' | 'low_or_out';

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');
function normalize(value: string): string {
  return value.normalize('NFD').replace(DIACRITICS, '').toLowerCase();
}

const DOT_CLASSES = {
  in_stock: 'bg-stock-in',
  low_stock: 'bg-stock-low',
  out_of_stock: 'bg-stock-out',
} as const;

export function AdminStockManager({ products, onChange }: AdminStockManagerProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const threshold = settings.lowStockThreshold ?? 5;

  const visibleProducts = useMemo(() => {
    const needle = normalize(search.trim());
    return products.filter((product) => {
      if (needle && !normalize(product.name).includes(needle)) return false;
      if (filter === 'low_or_out') {
        return product.variants.some((v) => v.stockQty <= threshold);
      }
      return true;
    });
  }, [products, search, filter, threshold]);

  function setVariantQty(productId: string, variantId: string, qty: number) {
    const safeQty = Math.max(0, Math.floor(qty) || 0);
    onChange(
      products.map((product) =>
        product.id === productId
          ? {
              ...product,
              variants: product.variants.map((v) =>
                v.id === variantId
                  ? { ...v, stockQty: safeQty, stockStatus: deriveStockStatus(safeQty, threshold) }
                  : v,
              ),
            }
          : product,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs text-stone-600">
        Acá se cargan las unidades cuando entra mercadería. Las ventas confirmadas ya descuentan solas.
      </p>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar producto..."
        className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      />

      <div className="flex flex-wrap gap-2">
        <FilterChip isActive={filter === 'all'} onClick={() => setFilter('all')}>
          Todos
        </FilterChip>
        <FilterChip isActive={filter === 'low_or_out'} onClick={() => setFilter('low_or_out')}>
          Para reponer
        </FilterChip>
      </div>

      {visibleProducts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-500">
          No hay productos que coincidan.
        </p>
      ) : (
        visibleProducts.map((product) => {
          const isOpen = openId === product.id;
          const outCount = product.variants.filter((v) => v.stockQty <= 0).length;
          const lowCount = product.variants.filter((v) => v.stockQty > 0 && v.stockQty <= threshold).length;
          const totalUnits = product.variants.reduce((sum, v) => sum + v.stockQty, 0);

          return (
            <div key={product.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : product.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                {product.images[0] && (
                  <img src={product.images[0]} alt="" className="h-12 w-10 shrink-0 rounded object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-sm font-semibold text-stone-900">{product.name}</p>
                  <p className="text-xs text-stone-500">
                    {CATEGORY_LABELS[product.category] ?? product.category} · {totalUnits} u. en total
                    {outCount > 0 && ` · ${outCount} sin stock`}
                    {lowCount > 0 && ` · ${lowCount} por reponer`}
                  </p>
                </div>
                <span className={`shrink-0 text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {isOpen && (
                <div className="flex flex-col gap-1 border-t border-stone-100 p-3">
                  {product.variants.map((variant) => (
                    <div key={variant.id} className="flex items-center gap-2 py-1">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASSES[variant.stockStatus]}`}
                        title={STOCK_LABELS[variant.stockStatus]}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-stone-700">
                        {variant.size} · {variant.color}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setVariantQty(product.id, variant.id, variant.stockQty - 1)}
                          aria-label={`Restar una unidad de ${variant.size} ${variant.color}`}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={variant.stockQty}
                          onChange={(e) => setVariantQty(product.id, variant.id, Number(e.target.value))}
                          aria-label={`Unidades de ${variant.size} ${variant.color}`}
                          className="w-14 rounded-lg border border-stone-300 py-1.5 text-center text-sm font-semibold"
                        />
                        <button
                          type="button"
                          onClick={() => setVariantQty(product.id, variant.id, variant.stockQty + 1)}
                          aria-label={`Sumar una unidad de ${variant.size} ${variant.color}`}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function FilterChip({ isActive, onClick, children }: { isActive: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        isActive
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'
      }`}
    >
      {children}
    </button>
  );
}
