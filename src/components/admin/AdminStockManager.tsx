import { useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Product } from '../../types/product';
import type { Supplier } from '../../types/supplier';
import { CATEGORY_LABELS } from '../../config/site.config';
import { settings } from '../../data/settings';
import { resolveImageUrl } from '../../data/apiClient';
import { deriveStockStatus, STOCK_LABELS } from '../../utils/stock';
import { BUSINESS_NAME } from '../../config/site.config';
import { buildRestockMessage, buildSupplierWhatsAppUrl } from '../../utils/supplier';
import { Chip } from '../ui/Chip';
import { Alert } from '../ui/Alert';
import { INPUT_CLASS } from '../ui/formStyles';

interface AdminStockManagerProps {
  products: Product[];
  /** Setter de React: se usa en forma funcional para que clics rápidos en +/− no se pisen. */
  onChange: Dispatch<SetStateAction<Product[]>>;
  /** Para poder escribirle al proveedor justo donde se ve que falta mercadería. */
  suppliers: Supplier[];
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

export function AdminStockManager({ products, onChange, suppliers }: AdminStockManagerProps) {
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

  /**
   * `updateQty` recibe la cantidad actual y devuelve la nueva. Se resuelve dentro del updater de
   * React (no sobre el prop) para que varios clics seguidos en +/− no se pisen entre sí.
   */
  function updateVariantQty(productId: string, variantId: string, updateQty: (current: number) => number) {
    onChange((prev) =>
      prev.map((product) =>
        product.id === productId
          ? {
              ...product,
              variants: product.variants.map((v) => {
                if (v.id !== variantId) return v;
                const safeQty = Math.max(0, Math.floor(updateQty(v.stockQty)) || 0);
                return { ...v, stockQty: safeQty, stockStatus: deriveStockStatus(safeQty, threshold) };
              }),
            }
          : product,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info">
        Ajustá las unidades a mano cuando entra mercadería, o para <strong>devolver stock</strong> si una clienta
        cancela o termina llevando menos prendas de las que había señado. Las ventas que registrás en la pestaña
        Ventas ya descuentan solas.
      </Alert>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar producto..."
        aria-label="Buscar producto"
        className={INPUT_CLASS}
      />

      <div className="flex flex-wrap gap-2">
        <Chip isActive={filter === 'all'} onClick={() => setFilter('all')}>
          Todos
        </Chip>
        <Chip isActive={filter === 'low_or_out'} onClick={() => setFilter('low_or_out')}>
          Para reponer
        </Chip>
      </div>

      {visibleProducts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-600">
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
                className="flex min-h-11 w-full items-center gap-3 p-3 text-left"
              >
                {product.images[0] && (
                  <img src={resolveImageUrl(product.images[0])} alt="" className="h-12 w-10 shrink-0 rounded object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-sm font-semibold text-stone-900">{product.name}</p>
                  <p className="text-xs text-stone-600">
                    {CATEGORY_LABELS[product.category] ?? product.category} · {totalUnits} u. en total
                    {outCount > 0 && ` · ${outCount} sin stock`}
                    {lowCount > 0 && ` · ${lowCount} por reponer`}
                  </p>
                </div>
                <span className={`shrink-0 text-stone-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {isOpen && (
                <div className="flex flex-col gap-1 border-t border-stone-100 p-3">
                  <SupplierRow
                    supplier={suppliers.find((s) => s.id === product.supplierId)}
                    product={product}
                    faltantes={outCount + lowCount}
                  />
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
                          onClick={() => updateVariantQty(product.id, variant.id, (q) => q - 1)}
                          aria-label={`Restar una unidad de ${variant.size} ${variant.color}`}
                          className="flex h-11 w-11 items-center justify-center rounded-lg border border-stone-300 text-lg text-stone-700 hover:bg-stone-50"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={variant.stockQty}
                          onChange={(e) => {
                            const typed = Number(e.target.value);
                            updateVariantQty(product.id, variant.id, () => typed);
                          }}
                          aria-label={`Unidades de ${variant.size} ${variant.color}`}
                          className="min-h-11 w-14 rounded-lg border border-stone-300 text-center text-sm font-semibold focus:border-brand-500"
                        />
                        <button
                          type="button"
                          onClick={() => updateVariantQty(product.id, variant.id, (q) => q + 1)}
                          aria-label={`Sumar una unidad de ${variant.size} ${variant.color}`}
                          className="flex h-11 w-11 items-center justify-center rounded-lg border border-stone-300 text-lg text-stone-700 hover:bg-stone-50"
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

/**
 * Muestra a quién comprarle este producto, en el mismo lugar donde se ve que hay que reponer.
 * Si el producto no tiene proveedor asignado lo dice, en vez de no mostrar nada.
 */
function SupplierRow({
  supplier,
  product,
  faltantes,
}: {
  supplier: Supplier | undefined;
  product: Product;
  faltantes: number;
}) {
  if (!supplier) {
    return (
      <p className="mb-2 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">
        Sin proveedor asignado. Podés elegirlo en la ficha del producto.
      </p>
    );
  }

  const detalle = faltantes > 0 ? `Me faltan ${faltantes} talle/color de este modelo.` : undefined;
  const url = buildSupplierWhatsAppUrl(supplier, buildRestockMessage(BUSINESS_NAME, product.name, detalle));

  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2">
      <p className="min-w-0 text-xs text-stone-700">
        Proveedor: <strong className="font-semibold">{supplier.name}</strong>
      </p>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-xs font-semibold text-brand-700 hover:text-brand-800"
        >
          Pedir reposición
        </a>
      )}
    </div>
  );
}
