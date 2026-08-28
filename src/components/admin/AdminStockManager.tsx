import { useMemo, useState } from 'react';
import type { Product, StockStatus } from '../../types/product';
import { CATEGORY_LABELS } from '../../config/site.config';
import { STOCK_LABELS } from '../../utils/stock';

interface AdminStockManagerProps {
  products: Product[];
  onChange: (products: Product[]) => void;
}

type StockFilter = 'all' | 'low_or_out' | 'out';

/** Al tocar una celda se rota el estado, que es lo más rápido para actualizar mucho stock seguido. */
const NEXT_STATUS: Record<StockStatus, StockStatus> = {
  in_stock: 'low_stock',
  low_stock: 'out_of_stock',
  out_of_stock: 'in_stock',
};

const CELL_CLASSES: Record<StockStatus, string> = {
  in_stock: 'bg-stock-in-soft text-stock-in ring-stock-in/30',
  low_stock: 'bg-stock-low-soft text-stock-low ring-stock-low/30',
  out_of_stock: 'bg-stock-out-soft text-stock-out ring-stock-out/25',
};

const CELL_SHORT: Record<StockStatus, string> = {
  in_stock: 'OK',
  low_stock: 'Poco',
  out_of_stock: '—',
};

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');
function normalize(value: string): string {
  return value.normalize('NFD').replace(DIACRITICS, '').toLowerCase();
}

export function AdminStockManager({ products, onChange }: AdminStockManagerProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');

  const visibleProducts = useMemo(() => {
    const needle = normalize(search.trim());
    return products.filter((product) => {
      if (needle && !normalize(product.name).includes(needle)) return false;
      if (filter === 'low_or_out') {
        return product.variants.some((v) => v.stockStatus !== 'in_stock');
      }
      if (filter === 'out') {
        return product.variants.some((v) => v.stockStatus === 'out_of_stock');
      }
      return true;
    });
  }, [products, search, filter]);

  function updateVariant(productId: string, variantId: string, status: StockStatus) {
    onChange(
      products.map((product) =>
        product.id === productId
          ? {
              ...product,
              variants: product.variants.map((v) => (v.id === variantId ? { ...v, stockStatus: status } : v)),
            }
          : product,
      ),
    );
  }

  function setAllForProduct(productId: string, status: StockStatus) {
    onChange(
      products.map((product) =>
        product.id === productId
          ? { ...product, variants: product.variants.map((v) => ({ ...v, stockStatus: status })) }
          : product,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
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
            Con faltantes
          </FilterChip>
          <FilterChip isActive={filter === 'out'} onClick={() => setFilter('out')}>
            Sin stock
          </FilterChip>
        </div>
      </div>

      <p className="text-xs text-stone-500">
        Tocá cada casillero para cambiar entre disponible, poco stock y sin stock.
      </p>

      {visibleProducts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-500">
          No hay productos que coincidan.
        </p>
      ) : (
        visibleProducts.map((product) => (
          <ProductStockCard
            key={product.id}
            product={product}
            onCycle={updateVariant}
            onSetAll={setAllForProduct}
          />
        ))
      )}
    </div>
  );
}

function FilterChip({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  children: string;
}) {
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

function ProductStockCard({
  product,
  onCycle,
  onSetAll,
}: {
  product: Product;
  onCycle: (productId: string, variantId: string, status: StockStatus) => void;
  onSetAll: (productId: string, status: StockStatus) => void;
}) {
  const outCount = product.variants.filter((v) => v.stockStatus === 'out_of_stock').length;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="mb-3 flex items-center gap-3">
        {product.images[0] && (
          <img src={product.images[0]} alt="" className="h-12 w-10 shrink-0 rounded object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-sm font-semibold text-stone-900">{product.name}</p>
          <p className="text-xs text-stone-500">
            {CATEGORY_LABELS[product.category] ?? product.category}
            {outCount > 0 && ` · ${outCount} sin stock`}
          </p>
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-10" />
              {product.colors.map((color) => (
                <th key={color.name} className="pb-1">
                  <span
                    title={color.name}
                    aria-label={color.name}
                    className="mx-auto block h-4 w-4 rounded-full ring-1 ring-inset ring-black/15"
                    style={{ backgroundColor: color.hex }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {product.sizes.map((size) => (
              <tr key={size}>
                <td className="w-10 pr-1 text-right text-xs font-semibold text-stone-600">{size}</td>
                {product.colors.map((color) => {
                  const variant = product.variants.find((v) => v.size === size && v.color === color.name);
                  if (!variant) {
                    return (
                      <td key={color.name} className="text-center text-xs text-stone-300">
                        —
                      </td>
                    );
                  }
                  return (
                    <td key={color.name}>
                      <button
                        type="button"
                        onClick={() => onCycle(product.id, variant.id, NEXT_STATUS[variant.stockStatus])}
                        title={`${size} / ${color.name}: ${STOCK_LABELS[variant.stockStatus]}`}
                        aria-label={`Talle ${size}, color ${color.name}: ${STOCK_LABELS[variant.stockStatus]}. Tocar para cambiar.`}
                        className={`h-10 w-full min-w-11 rounded-lg text-[11px] font-bold uppercase ring-1 ring-inset transition-colors ${
                          CELL_CLASSES[variant.stockStatus]
                        }`}
                      >
                        {CELL_SHORT[variant.stockStatus]}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-stone-100 pt-3">
        <button
          type="button"
          onClick={() => onSetAll(product.id, 'in_stock')}
          className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
        >
          Todo disponible
        </button>
        <button
          type="button"
          onClick={() => onSetAll(product.id, 'out_of_stock')}
          className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
        >
          Todo sin stock
        </button>
      </div>
    </div>
  );
}
