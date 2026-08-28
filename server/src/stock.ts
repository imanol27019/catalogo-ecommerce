// Copia de la regla que usa el sitio (src/utils/stock.ts). Se duplica a propósito: el servidor
// no comparte build con el frontend, y esta regla tiene que aplicarse sí o sí del lado del
// servidor para que el stock no dependa de lo que mande el navegador.

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export function deriveStockStatus(stockQty: number, lowStockThreshold: number): StockStatus {
  if (stockQty <= 0) return 'out_of_stock';
  if (stockQty <= lowStockThreshold) return 'low_stock';
  return 'in_stock';
}

interface VariantLike {
  id: string;
  stockQty?: number;
  stockStatus?: StockStatus;
  [key: string]: unknown;
}

interface ProductLike {
  id: string;
  variants: VariantLike[];
  [key: string]: unknown;
}

/**
 * Normaliza el catálogo: asegura que cada variante tenga un número de unidades y recalcula el
 * estado a partir de él. Así el estado nunca puede contradecir a las unidades, venga de donde venga.
 */
export function normalizeCatalogStock<T extends ProductLike>(products: T[], lowStockThreshold: number): T[] {
  return products.map((product) => ({
    ...product,
    variants: product.variants.map((variant) => {
      const qty = typeof variant.stockQty === 'number' && Number.isFinite(variant.stockQty)
        ? Math.max(0, Math.floor(variant.stockQty))
        : fallbackQtyFromStatus(variant.stockStatus, lowStockThreshold);
      return { ...variant, stockQty: qty, stockStatus: deriveStockStatus(qty, lowStockThreshold) };
    }),
  }));
}

/** Para datos viejos que solo tenían estado y no unidades. */
function fallbackQtyFromStatus(status: StockStatus | undefined, lowStockThreshold: number): number {
  if (status === 'out_of_stock') return 0;
  if (status === 'low_stock') return Math.max(1, lowStockThreshold);
  return lowStockThreshold + 10;
}
