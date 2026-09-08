import type { BulkPriceTier, Product } from '../types/product';
import type { CartLineItem, CartTotals } from '../types/cart';

/** Precio de oferta si está definido y es menor al de lista; si no, el precio de lista. */
export function getEffectivePrice(product: Pick<Product, 'unitPrice' | 'salePrice'>): number {
  return product.salePrice != null && product.salePrice < product.unitPrice ? product.salePrice : product.unitPrice;
}

export function isOnSale(product: Pick<Product, 'unitPrice' | 'salePrice'>): boolean {
  return product.salePrice != null && product.salePrice < product.unitPrice;
}

/** Máximo de escalones por producto. Más que esto vuelve la lista de precios ilegible. */
export const MAX_BULK_TIERS = 4;

/** Escalones ordenados de menor a mayor cantidad, descartando los que no tienen sentido. */
export function sortBulkTiers(tiers: BulkPriceTier[] | undefined): BulkPriceTier[] {
  if (!tiers?.length) return [];
  return [...tiers].filter((t) => t.minQty > 0 && t.price >= 0).sort((a, b) => a.minQty - b.minQty);
}

/**
 * Unidades totales de cada producto en el carrito, sumando TODOS sus talles y colores.
 *
 * Los escalones por cantidad se calculan sobre este total y no sobre cada línea: quien lleva
 * 4 remeras negras S y 4 blancas M lleva 8 unidades del mismo modelo y accede al escalón de 8.
 */
export function computeQtyByProduct(items: Pick<CartLineItem, 'productId' | 'qty'>[]): Map<string, number> {
  const porProducto = new Map<string, number>();
  for (const item of items) {
    porProducto.set(item.productId, (porProducto.get(item.productId) ?? 0) + item.qty);
  }
  return porProducto;
}

/**
 * Precio unitario que corresponde a `productQty` unidades del producto.
 * `productQty` son las unidades del producto entero, no las de una línea.
 */
export function unitPriceForQty(
  pricing: { unitPrice: number; bulkPricing?: BulkPriceTier[] },
  productQty: number,
): number {
  const escalones = sortBulkTiers(pricing.bulkPricing);
  if (escalones.length === 0) return pricing.unitPrice;
  const alcanzado = escalones.filter((t) => productQty >= t.minQty).pop();
  return alcanzado ? alcanzado.price : pricing.unitPrice;
}

/** Próximo escalón que todavía no se alcanzó con `productQty` unidades, si queda alguno. */
export function nextBulkTier(
  pricing: { unitPrice: number; bulkPricing?: BulkPriceTier[] },
  productQty: number,
): BulkPriceTier | undefined {
  return sortBulkTiers(pricing.bulkPricing).find((t) => productQty < t.minQty);
}

/**
 * Precio unitario de cada línea del carrito, resuelto contra las unidades totales de su producto.
 * Devuelve un mapa por `lineId` para no recalcular el agregado en cada renglón.
 */
export function computeUnitPriceByLine(items: CartLineItem[]): Map<string, number> {
  const porProducto = computeQtyByProduct(items);
  const porLinea = new Map<string, number>();
  for (const item of items) {
    const cantidadDelProducto = porProducto.get(item.productId) ?? item.qty;
    porLinea.set(item.lineId, unitPriceForQty(item, cantidadDelProducto));
  }
  return porLinea;
}

export function computeCartTotals(items: CartLineItem[]): CartTotals {
  const precioPorLinea = computeUnitPriceByLine(items);
  const subtotal = items.reduce((sum, item) => sum + (precioPorLinea.get(item.lineId) ?? item.unitPrice) * item.qty, 0);
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
  return { itemCount, subtotal, grandTotal: subtotal };
}

/**
 * Un escalón mal cargado es plata mal cobrada, así que esto bloquea el guardado en vez de avisar
 * y dejar pasar. Devuelve el problema encontrado, o `null` si la escalera es coherente.
 */
export function validateBulkTiers(tiers: BulkPriceTier[], precioBase: number): string | null {
  if (tiers.length === 0) return null;
  if (tiers.length > MAX_BULK_TIERS) return `Como máximo podés definir ${MAX_BULK_TIERS} escalones.`;

  const ordenados = [...tiers].sort((a, b) => a.minQty - b.minQty);

  for (const tier of ordenados) {
    if (!Number.isFinite(tier.minQty) || tier.minQty < 2) {
      return 'Cada escalón tiene que arrancar en 2 unidades o más.';
    }
    if (!Number.isFinite(tier.price) || tier.price <= 0) {
      return 'Cada escalón necesita un precio mayor a cero.';
    }
    if (tier.price >= precioBase) {
      return `Un escalón tiene que costar menos que el precio unitario (${precioBase}). Si no, no es un descuento.`;
    }
  }

  for (let i = 1; i < ordenados.length; i++) {
    if (ordenados[i].minQty === ordenados[i - 1].minQty) {
      return `Hay dos escalones que arrancan en ${ordenados[i].minQty} unidades. Las cantidades no se pueden repetir.`;
    }
    if (ordenados[i].price >= ordenados[i - 1].price) {
      return 'A mayor cantidad, el precio tiene que ser menor. Revisá el orden de los escalones.';
    }
  }

  return null;
}
