import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Product } from '../../types/product';
import { createManualSale } from '../../data/orders';
import { ApiError } from '../../data/apiClient';
import { formatCurrency } from '../../utils/format';
import { computeLineUnitPrice, getEffectivePrice } from '../../utils/pricing';
import { STOCK_LABELS } from '../../utils/stock';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { INPUT_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from '../ui/formStyles';

interface AdminManualSaleFormProps {
  products: Product[];
  adminPassword: string;
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
  onAuthError: () => void;
}

interface DraftLine {
  productId: string;
  variantId: string;
  qty: number;
}

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');
function normalize(v: string) {
  return v.normalize('NFD').replace(DIACRITICS, '').toLowerCase();
}

export function AdminManualSaleForm({
  products,
  adminPassword,
  onCancel,
  onSaved,
  onAuthError,
}: AdminManualSaleFormProps) {
  const [customerName, setCustomerName] = useState('');
  const [locality, setLocality] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [search, setSearch] = useState('');
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeProducts = useMemo(() => products.filter((p) => p.status === 'active'), [products]);

  const searchResults = useMemo(() => {
    const needle = normalize(search.trim());
    if (!needle) return [];
    return activeProducts.filter((p) => normalize(p.name).includes(needle)).slice(0, 6);
  }, [activeProducts, search]);

  /**
   * Mismo cálculo que hace el servidor al registrar la venta (oferta + precio por bulto), para que
   * el total que se ve acá sea exactamente el que queda guardado.
   */
  function lineUnitPrice(product: Product, qty: number): number {
    return computeLineUnitPrice({ unitPrice: getEffectivePrice(product), bulkPricing: product.bulkPricing, qty });
  }

  const total = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const product = products.find((p) => p.id === line.productId);
        return product ? sum + lineUnitPrice(product, line.qty) * line.qty : sum;
      }, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, products],
  );

  function addVariant(productId: string, variantId: string) {
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === variantId);
      if (existing) {
        return prev.map((l) => (l.variantId === variantId ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { productId, variantId, qty: 1 }];
    });
  }

  function setQty(variantId: string, qty: number) {
    setLines((prev) =>
      prev.map((l) => (l.variantId === variantId ? { ...l, qty: Math.max(1, qty) } : l)),
    );
  }

  function removeLine(variantId: string) {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (lines.length === 0) {
      setError('Agregá al menos un producto.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createManualSale(
        {
          customer: {
            name: customerName.trim() || 'Venta en el local',
            locality: locality.trim(),
            shippingMethodLabel: 'Retiro en el local',
          },
          lines,
        },
        adminPassword,
      );
      await onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onAuthError();
        return;
      }
      setError(err instanceof ApiError ? err.userMessage : 'No se pudo registrar la venta.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-base font-semibold text-stone-900">Cargar venta</h2>
        <button type="button" onClick={onCancel} className="inline-flex min-h-11 items-center text-sm font-semibold text-stone-600 hover:text-stone-900">
          Volver
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Clienta / local (opcional)</span>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Venta en el local"
            className={INPUT_CLASS}
          />
        </label>
        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Localidad (opcional)</span>
          <input
            value={locality}
            onChange={(e) => setLocality(e.target.value)}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">Agregar productos</p>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto..."
          className={INPUT_CLASS}
        />

        {searchResults.map((product) => (
          <div key={product.id} className="mt-2 rounded-lg border border-stone-200 p-2.5">
            <p className="text-sm font-semibold text-stone-900">{product.name}</p>
            <p className="mb-2 text-xs text-stone-500">{formatCurrency(getEffectivePrice(product))} c/u</p>
            <div className="flex flex-wrap gap-1.5">
              {product.variants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  disabled={variant.stockQty <= 0}
                  onClick={() => addVariant(product.id, variant.id)}
                  title={`${STOCK_LABELS[variant.stockStatus]} · ${variant.stockQty} u.`}
                  className="min-h-11 rounded-lg border border-stone-300 px-2.5 text-xs font-medium text-stone-700 hover:border-brand-500 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {variant.size}/{variant.color}
                  <span className="ml-1 text-stone-500">({variant.stockQty})</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {lines.length > 0 && (
        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Detalle</p>
          <div className="flex flex-col gap-2">
            {lines.map((line) => {
              const product = products.find((p) => p.id === line.productId);
              const variant = product?.variants.find((v) => v.id === line.variantId);
              if (!product || !variant) return null;
              const overStock = line.qty > variant.stockQty;
              return (
                <div key={line.variantId} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 text-stone-700">
                    {product.name} <span className="text-stone-500">({variant.size}/{variant.color})</span>
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={line.qty}
                    onChange={(e) => setQty(line.variantId, Number(e.target.value) || 1)}
                    className={`min-h-11 w-16 rounded-lg border px-2 text-center text-sm ${
                      overStock ? 'border-stock-low text-stock-low' : 'border-stone-300'
                    }`}
                  />
                  <span className="w-24 shrink-0 text-right font-medium text-stone-900">
                    {formatCurrency(lineUnitPrice(product, line.qty) * line.qty)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLine(line.variantId)}
                    className="text-stone-500 hover:text-red-500"
                    aria-label="Quitar"
                  >
                    ×
                  </button>
                  {overStock && (
                    <p className="w-full text-xs text-stock-low">
                      Hay {variant.stockQty} u. registradas. Se puede vender igual: el stock queda en 0.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3 font-heading text-base font-semibold text-stone-900">
            <span>Total</span>
            <span className="text-brand-600">{formatCurrency(total)}</span>
          </div>
        </div>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving || lines.length === 0}>
          {isSaving ? 'Guardando…' : 'Registrar venta'}
        </Button>
      </div>
      <p className="text-right text-xs text-stone-500">Al registrarla se descuenta el stock automáticamente.</p>
    </form>
  );
}
