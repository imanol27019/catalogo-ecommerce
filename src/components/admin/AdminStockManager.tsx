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
import { plural } from '../../utils/format';
import { Chip } from '../ui/Chip';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { INPUT_CLASS, INPUT_COMPACT_CLASS } from '../ui/formStyles';

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
  /**
   * Productos que faltaban cuando se abrió "Para reponer". La lista se congela en ese momento: si se
   * recalculara en vivo, un producto desaparecía apenas se le sumaba la primera unidad y no se podía
   * terminar de cargar. Tocar el filtro de nuevo la actualiza.
   */
  const [restockIds, setRestockIds] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const threshold = settings.lowStockThreshold ?? 5;

  function needsRestock(product: Product): boolean {
    return product.variants.some((v) => v.stockQty <= threshold);
  }

  function showRestock() {
    setRestockIds(new Set(products.filter(needsRestock).map((p) => p.id)));
    setFilter('low_or_out');
  }

  const visibleProducts = useMemo(() => {
    const needle = normalize(search.trim());
    return products.filter((product) => {
      if (needle && !normalize(product.name).includes(needle)) return false;
      if (filter === 'low_or_out') return restockIds.has(product.id);
      return true;
    });
  }, [products, search, filter, restockIds]);

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

  /** Suma de una vez lo que entró de cada talle/color. */
  function addReceived(product: Product, received: Record<string, number>) {
    const total = Object.values(received).reduce((sum, n) => sum + n, 0);
    for (const [variantId, qty] of Object.entries(received)) {
      if (qty > 0) updateVariantQty(product.id, variantId, (current) => current + qty);
    }
    setReceivingId(null);
    setNotice(`Se sumaron ${plural(total, 'prenda', 'prendas')} a ${product.name}. Acordate de publicar los cambios.`);
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info">
        Ajustá las unidades a mano, o usá <strong>Cargar ingreso</strong> cuando entra mercadería para sumar varias de una.
        También sirve para <strong>devolver stock</strong> si una clienta termina llevando menos. Las ventas ya descuentan
        solas.
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
        <Chip isActive={filter === 'low_or_out'} onClick={showRestock}>
          Para reponer
        </Chip>
      </div>

      {filter === 'low_or_out' && (
        <p className="-mt-2 text-xs text-stone-600">
          Lista armada al abrir el filtro: lo que vas reponiendo queda acá marcado como repuesto. Tocá “Para reponer” de nuevo
          para actualizarla.
        </p>
      )}

      {notice && (
        <Alert tone="success" className="-mt-1">
          {notice}
        </Alert>
      )}

      {visibleProducts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-600">
          {filter === 'low_or_out' ? 'No hay nada para reponer.' : 'No hay productos que coincidan.'}
        </p>
      ) : (
        visibleProducts.map((product) => {
          const isOpen = openId === product.id;
          const outCount = product.variants.filter((v) => v.stockQty <= 0).length;
          const lowCount = product.variants.filter((v) => v.stockQty > 0 && v.stockQty <= threshold).length;
          const totalUnits = product.variants.reduce((sum, v) => sum + v.stockQty, 0);
          const isRestocked = filter === 'low_or_out' && !needsRestock(product);

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
                {isRestocked && <Badge tone="stock-in">Repuesto</Badge>}
                <span className={`shrink-0 text-stone-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {isOpen && (
                <div className="flex flex-col gap-1 border-t border-stone-100 p-3">
                  <SupplierRow
                    supplier={suppliers.find((s) => s.id === product.supplierId)}
                    product={product}
                    faltantes={outCount + lowCount}
                  />

                  {receivingId === product.id ? (
                    <ReceiveForm
                      product={product}
                      onCancel={() => setReceivingId(null)}
                      onConfirm={(received) => addReceived(product, received)}
                    />
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        className="mb-1 self-start"
                        onClick={() => {
                          setNotice(null);
                          setReceivingId(product.id);
                        }}
                      >
                        + Cargar ingreso de mercadería
                      </Button>
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
                              inputMode="numeric"
                              min={0}
                              value={variant.stockQty}
                              // Al entrar se selecciona todo: así escribir "10" deja 10 y no "010".
                              onFocus={(e) => e.target.select()}
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
                    </>
                  )}
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
 * Ingreso de mercadería: se escribe cuántas entraron de cada talle/color y se suman todas juntas
 * a lo que ya había. Para cuando llega un pedido del proveedor y hay que cargar 10 de cada una.
 */
function ReceiveForm({
  product,
  onCancel,
  onConfirm,
}: {
  product: Product;
  onCancel: () => void;
  onConfirm: (received: Record<string, number>) => void;
}) {
  const [received, setReceived] = useState<Record<string, number>>({});
  const [sameForAll, setSameForAll] = useState(0);
  const total = Object.values(received).reduce((sum, n) => sum + n, 0);

  function setAmount(variantId: string, value: number) {
    setReceived((prev) => ({ ...prev, [variantId]: Math.max(0, Math.round(value) || 0) }));
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-brand-200 bg-brand-50/40 p-3">
      <p className="font-heading text-sm font-semibold text-stone-900">¿Cuántas entraron?</p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-stone-700">Mismo número para todos:</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={sameForAll || ''}
          onChange={(e) => setSameForAll(Math.max(0, Math.round(Number(e.target.value)) || 0))}
          aria-label="Cantidad para todos los talles y colores"
          className={`${INPUT_COMPACT_CLASS} w-20 text-center`}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={sameForAll <= 0}
          onClick={() => setReceived(Object.fromEntries(product.variants.map((v) => [v.id, sameForAll])))}
        >
          Completar
        </Button>
      </div>

      <ul className="flex flex-col divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white px-3">
        {product.variants.map((variant) => {
          const amount = received[variant.id] ?? 0;
          return (
            <li key={variant.id} className="flex items-center gap-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-sm text-stone-700">
                {variant.size} · {variant.color}
                <span className="text-xs text-stone-600"> (hay {variant.stockQty})</span>
              </span>
              <span aria-hidden="true" className="text-sm text-stone-600">
                +
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={amount || ''}
                placeholder="0"
                onChange={(e) => setAmount(variant.id, Number(e.target.value))}
                aria-label={`Entraron de ${variant.size} ${variant.color}`}
                className={`${INPUT_COMPACT_CLASS} w-20 text-center`}
              />
              <span className="w-16 shrink-0 text-right text-xs text-stone-600">
                {amount > 0 ? `queda ${variant.stockQty + amount}` : ''}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" disabled={total <= 0} onClick={() => onConfirm(received)}>
          {total > 0 ? `Sumar ${plural(total, 'prenda', 'prendas')}` : 'Sumar al stock'}
        </Button>
      </div>
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
