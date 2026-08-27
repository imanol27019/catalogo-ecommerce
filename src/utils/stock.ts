import type { Product, ProductVariant, StockStatus } from '../types/product';

export function findVariant(
  product: Pick<Product, 'variants'>,
  size: string,
  color: string,
): ProductVariant | undefined {
  return product.variants.find((v) => v.size === size && v.color === color);
}

/** Peor caso entre todas las variantes de un producto — para el badge de la grilla. */
export function getProductAggregateStock(product: Pick<Product, 'variants'>): StockStatus {
  if (product.variants.length === 0) return 'out_of_stock';
  if (product.variants.some((v) => v.stockStatus === 'in_stock')) return 'in_stock';
  if (product.variants.some((v) => v.stockStatus === 'low_stock')) return 'low_stock';
  return 'out_of_stock';
}

export function effectiveMinQty(
  product: Pick<Product, 'minQtyPerVariant'>,
  variant: Pick<ProductVariant, 'minQtyOverride'>,
): number {
  return variant.minQtyOverride ?? product.minQtyPerVariant;
}

export const STOCK_LABELS: Record<StockStatus, string> = {
  in_stock: 'Disponible',
  low_stock: 'Poco stock',
  out_of_stock: 'Sin stock',
};
