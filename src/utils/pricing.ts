import type { BulkPriceTier, Product } from '../types/product';
import type { CartLineItem, CartTotals } from '../types/cart';

/** Precio de oferta si está definido y es menor al de lista; si no, el precio de lista. */
export function getEffectivePrice(product: Pick<Product, 'unitPrice' | 'salePrice'>): number {
  return product.salePrice != null && product.salePrice < product.unitPrice ? product.salePrice : product.unitPrice;
}

export function isOnSale(product: Pick<Product, 'unitPrice' | 'salePrice'>): boolean {
  return product.salePrice != null && product.salePrice < product.unitPrice;
}

export function computeLineUnitPrice(item: {
  unitPrice: number;
  bulkPricing?: BulkPriceTier[];
  qty: number;
}): number {
  if (!item.bulkPricing?.length) return item.unitPrice;
  const applicable = [...item.bulkPricing]
    .sort((a, b) => a.minQty - b.minQty)
    .filter((tier) => item.qty >= tier.minQty)
    .pop();
  return applicable ? applicable.price : item.unitPrice;
}

/** Precio por unidad del próximo escalón de bulto, si todavía no se alcanzó. */
export function nextBulkTier(item: {
  unitPrice: number;
  bulkPricing?: BulkPriceTier[];
  qty: number;
}): BulkPriceTier | undefined {
  if (!item.bulkPricing?.length) return undefined;
  return [...item.bulkPricing]
    .sort((a, b) => a.minQty - b.minQty)
    .find((tier) => item.qty < tier.minQty);
}

export function computeLineSubtotal(item: CartLineItem): number {
  return computeLineUnitPrice(item) * item.qty;
}

export function computeCartTotals(items: CartLineItem[]): CartTotals {
  const subtotal = items.reduce((sum, item) => sum + computeLineSubtotal(item), 0);
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
  return { itemCount, subtotal, grandTotal: subtotal };
}
