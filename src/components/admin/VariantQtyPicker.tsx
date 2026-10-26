import { useMemo, useState } from 'react';
import type { Product } from '../../types/product';
import { resolveImageUrl } from '../../data/apiClient';
import { formatCurrency, plural } from '../../utils/format';
import { getEffectivePrice } from '../../utils/pricing';
import { normalizeSearch } from '../../utils/sales';
import { Button } from '../ui/Button';
import { INPUT_CLASS, INPUT_COMPACT_CLASS } from '../ui/formStyles';

export interface PickedItem {
  productId: string;
  variantId: string;
  qty: number;
}

interface VariantQtyPickerProps {
  products: Product[];
  /** Cuántas se pueden elegir de un talle/color (el stock, descontando lo que ya se cargó). */
  availableOf: (product: Product, variantId: string) => number;
  /** Texto del botón para N prendas elegidas (ej: "Agregar 5 a la bolsa"). */
  addLabel: (units: number) => string;
  /** Devuelve `true` si se agregaron: recién ahí se limpia la selección. */
  onAdd: (items: PickedItem[]) => Promise<boolean> | boolean;
  isBusy?: boolean;
  /**
   * Dónde queda pegada la barra de "Agregar". En el formulario de venta hay otra barra fija abajo
   * en celular (la del total), así que esta se apoya encima de aquella en vez de taparla.
   */
  stickyClassName?: string;
}

const key = (productId: string, variantId: string) => `${productId}::${variantId}`;

/**
 * Selector de prendas por cantidad. Se elige el modelo y aparece una grilla talle × color donde se
 * escribe cuántas de cada combinación; se pueden elegir varias de varios modelos y agregarlas
 * todas juntas con un solo botón. Tocar una casilla vacía ya pone 1, que es el caso más común en
 * un live.
 */
export function VariantQtyPicker({
  products,
  availableOf,
  addLabel,
  onAdd,
  isBusy = false,
  stickyClassName = 'bottom-0',
}: VariantQtyPickerProps) {
  const [search, setSearch] = useState('');
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Map<string, PickedItem>>(new Map());

  const visibleProducts = useMemo(() => {
    const needle = normalizeSearch(search);
    const list = products.filter((p) => p.status !== 'archived');
    return (needle ? list.filter((p) => normalizeSearch(`${p.name} ${p.category}`).includes(needle)) : list).slice(0, needle ? 15 : 10);
  }, [products, search]);

  const totalUnits = [...selection.values()].reduce((sum, item) => sum + item.qty, 0);
  const modelCount = new Set([...selection.values()].map((item) => item.productId)).size;

  function setQty(product: Product, variantId: string, qty: number) {
    const max = Math.max(0, availableOf(product, variantId));
    const safe = Math.max(0, Math.min(max, Math.floor(qty) || 0));
    setSelection((prev) => {
      const next = new Map(prev);
      if (safe > 0) next.set(key(product.id, variantId), { productId: product.id, variantId, qty: safe });
      else next.delete(key(product.id, variantId));
      return next;
    });
  }

  function fillProduct(product: Product, each: number) {
    for (const variant of product.variants) setQty(product, variant.id, each);
  }

  async function handleAdd() {
    const items = [...selection.values()];
    if (items.length === 0) return;
    if (await onAdd(items)) setSelection(new Map());
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        // Enter en el buscador no tiene que mandar un formulario a medio cargar.
        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
        placeholder="Buscar modelo…"
        aria-label="Buscar modelo"
        className={INPUT_CLASS}
      />

      <ul className="flex flex-col gap-1.5">
        {visibleProducts.map((product) => {
          const isOpen = openProductId === product.id;
          const picked = product.variants.reduce((sum, v) => sum + (selection.get(key(product.id, v.id))?.qty ?? 0), 0);
          return (
            <li key={product.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
              <button
                type="button"
                onClick={() => setOpenProductId(isOpen ? null : product.id)}
                aria-expanded={isOpen}
                className="flex min-h-11 w-full items-center gap-3 px-2.5 py-1.5 text-left hover:bg-stone-50"
              >
                {product.images[0] ? (
                  <img src={resolveImageUrl(product.images[0])} alt="" className="h-12 w-10 shrink-0 rounded object-cover" />
                ) : (
                  <span aria-hidden="true" className="h-12 w-10 shrink-0 rounded bg-brand-100" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-stone-900">{product.name}</span>
                  <span className="block text-xs text-stone-600">
                    {formatCurrency(getEffectivePrice(product))}
                    {product.status === 'draft' && ' · no publicado'}
                  </span>
                </span>
                {picked > 0 && (
                  <span className="shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
                    {picked}
                  </span>
                )}
                <span aria-hidden="true" className={`shrink-0 text-stone-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </button>
              {isOpen && (
                <QtyMatrix
                  product={product}
                  qtyOf={(variantId) => selection.get(key(product.id, variantId))?.qty ?? 0}
                  availableOf={(variantId) => availableOf(product, variantId)}
                  onQty={(variantId, qty) => setQty(product, variantId, qty)}
                  onFill={(each) => fillProduct(product, each)}
                />
              )}
            </li>
          );
        })}
        {visibleProducts.length === 0 && (
          <li className="rounded-lg border border-dashed border-stone-300 px-3 py-4 text-center text-sm text-stone-600">
            No hay modelos con ese nombre.
          </li>
        )}
      </ul>

      {totalUnits > 0 && (
        // Queda pegado abajo mientras se recorre la lista: la selección se ve siempre.
        <div className={`sticky ${stickyClassName} z-10 -mx-1 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur`}>
          <p className="text-sm text-stone-700">
            <strong className="font-semibold text-stone-900">{plural(totalUnits, 'prenda', 'prendas')}</strong>
            {modelCount > 1 && ` de ${modelCount} modelos`}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setSelection(new Map())} disabled={isBusy}>
              Limpiar
            </Button>
            <Button type="button" onClick={() => void handleAdd()} disabled={isBusy}>
              {isBusy ? 'Agregando…' : addLabel(totalUnits)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function QtyMatrix({
  product,
  qtyOf,
  availableOf,
  onQty,
  onFill,
}: {
  product: Product;
  qtyOf: (variantId: string) => number;
  availableOf: (variantId: string) => number;
  onQty: (variantId: string, qty: number) => void;
  onFill: (each: number) => void;
}) {
  const [each, setEach] = useState(1);

  // Grilla talle × color cuando todas las variantes encajan en ella; si no, una lista simple.
  const sizes = product.sizes.filter((size) => product.variants.some((v) => v.size === size));
  const colors = product.colors.filter((color) => product.variants.some((v) => v.color === color.name));
  const fitsGrid =
    sizes.length > 0 &&
    colors.length > 0 &&
    product.variants.every((v) => sizes.includes(v.size) && colors.some((c) => c.name === v.color));

  function cell(variantId: string, label: string) {
    const available = availableOf(variantId);
    const qty = qtyOf(variantId);
    if (available <= 0 && qty === 0) {
      return (
        <span className="flex min-h-11 items-center justify-center rounded-lg bg-stone-50 text-xs text-stone-500" title="Sin stock">
          sin stock
        </span>
      );
    }
    return (
      <div className="flex flex-col items-center">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={available}
          value={qty || ''}
          placeholder="0"
          // Tocar una casilla vacía ya elige 1; para más, se escribe encima.
          onClick={(e) => {
            const input = e.currentTarget;
            if (qty === 0) onQty(variantId, 1);
            // Se selecciona después de que aparezca el 1: así lo que se escriba lo reemplaza
            // ("3" deja 3, no 13).
            setTimeout(() => input.select(), 0);
          }}
          onChange={(e) => onQty(variantId, Number(e.target.value))}
          aria-label={`Cantidad de ${label} (hay ${available})`}
          className={`${INPUT_COMPACT_CLASS} w-12 px-1 text-center font-semibold ${qty > 0 ? 'border-brand-500 bg-brand-50' : ''}`}
        />
        <span className="mt-0.5 text-[11px] text-stone-600">hay {available}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-stone-100 p-2.5">
      <div className="flex flex-wrap items-center gap-2 text-sm text-stone-700">
        <span>De cada uno:</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={each || ''}
          onChange={(e) => setEach(Math.max(0, Math.floor(Number(e.target.value)) || 0))}
          aria-label="Cantidad de cada talle y color"
          className={`${INPUT_COMPACT_CLASS} w-16 text-center`}
        />
        <Button type="button" variant="secondary" disabled={each <= 0} onClick={() => onFill(each)}>
          Completar
        </Button>
        <Button type="button" variant="ghost" onClick={() => onFill(0)}>
          Borrar
        </Button>
      </div>

      {fitsGrid ? (
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th scope="col" className="sr-only">
                  Color
                </th>
                {sizes.map((size) => (
                  <th key={size} scope="col" className="px-1 text-center text-xs font-semibold text-stone-700">
                    {size}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colors.map((color) => (
                <tr key={color.name}>
                  <th scope="row" className="pr-1 text-left align-top text-xs font-medium text-stone-700">
                    <span className="flex min-h-11 items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="h-3 w-3 shrink-0 rounded-full border border-stone-300"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span className="max-w-16 truncate" title={color.name}>{color.name}</span>
                    </span>
                  </th>
                  {sizes.map((size) => {
                    const variant = product.variants.find((v) => v.size === size && v.color === color.name);
                    return (
                      <td key={size} className="align-top">
                        {variant ? cell(variant.id, `${size} ${color.name}`) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {product.variants.map((variant) => {
            const label = [variant.size, variant.color].filter(Boolean).join(' / ');
            return (
              <li key={variant.id} className="flex items-center justify-between gap-2">
                <span className="text-sm text-stone-700">{label}</span>
                {cell(variant.id, label)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
