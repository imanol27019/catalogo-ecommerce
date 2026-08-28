import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { deriveStockStatus } from './stock';

export type OrderStatus = 'pending' | 'confirmed' | 'cancelled';
export type OrderSource = 'whatsapp' | 'manual';

export interface OrderLine {
  productId: string;
  productName: string;
  variantId: string;
  size: string;
  color: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderCustomer {
  name: string;
  locality: string;
  shippingMethodLabel: string;
  comment?: string;
}

export interface Order {
  id: string;
  code: string;
  createdAt: string;
  status: OrderStatus;
  source: OrderSource;
  customer: OrderCustomer;
  lines: OrderLine[];
  itemCount: number;
  total: number;
  resolvedAt?: string;
}

/** Tope defensivo: el endpoint de creación es público, así que no puede aceptar cualquier cosa. */
const MAX_LINES = 60;
const MAX_QTY_PER_LINE = 9999;

export class OrderValidationError extends Error {}

function shortCode(): string {
  return Math.random().toString(36).toUpperCase().slice(2, 6);
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

interface CatalogProduct {
  id: string;
  name: string;
  unitPrice: number;
  salePrice?: number;
  bulkPricing?: { minQty: number; price: number }[];
  variants: { id: string; size: string; color: string; stockQty: number }[];
}

function effectiveUnitPrice(product: CatalogProduct, qty: number): number {
  const base =
    typeof product.salePrice === 'number' && product.salePrice < product.unitPrice
      ? product.salePrice
      : product.unitPrice;
  if (!product.bulkPricing?.length) return base;
  const tier = [...product.bulkPricing]
    .sort((a, b) => a.minQty - b.minQty)
    .filter((t) => qty >= t.minQty)
    .pop();
  return tier ? tier.price : base;
}

/**
 * Arma la venta a partir del catálogo real. Los precios NUNCA vienen del navegador: se recalculan
 * acá, así un pedido manipulado no puede alterar los importes que ve el negocio.
 */
export function buildOrder(
  payload: unknown,
  catalogProducts: CatalogProduct[],
  source: OrderSource,
  status: OrderStatus,
): Order {
  const body = (payload ?? {}) as Record<string, unknown>;
  const customerRaw = (body.customer ?? {}) as Record<string, unknown>;
  const linesRaw = Array.isArray(body.lines) ? body.lines : [];

  if (linesRaw.length === 0) throw new OrderValidationError('El pedido no tiene productos.');
  if (linesRaw.length > MAX_LINES) throw new OrderValidationError('El pedido tiene demasiados renglones.');

  const name = text(customerRaw.name, 120);
  if (!name) throw new OrderValidationError('Falta el nombre de quien compra.');

  const lines: OrderLine[] = [];
  for (const raw of linesRaw as Record<string, unknown>[]) {
    const product = catalogProducts.find((p) => p.id === raw.productId);
    if (!product) throw new OrderValidationError(`Producto inexistente: ${String(raw.productId)}`);
    const variant = product.variants.find((v) => v.id === raw.variantId);
    if (!variant) throw new OrderValidationError(`Variante inexistente: ${String(raw.variantId)}`);

    const qty = Math.floor(Number(raw.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      throw new OrderValidationError(`Cantidad inválida para ${product.name}.`);
    }

    const unitPrice = effectiveUnitPrice(product, qty);
    lines.push({
      productId: product.id,
      productName: product.name,
      variantId: variant.id,
      size: variant.size,
      color: variant.color,
      qty,
      unitPrice,
      subtotal: unitPrice * qty,
    });
  }

  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    code: shortCode(),
    createdAt: now,
    status,
    source,
    customer: {
      name,
      locality: text(customerRaw.locality, 120),
      shippingMethodLabel: text(customerRaw.shippingMethodLabel, 120),
      ...(text(customerRaw.comment, 500) ? { comment: text(customerRaw.comment, 500) } : {}),
    },
    lines,
    itemCount: lines.reduce((sum, l) => sum + l.qty, 0),
    total: lines.reduce((sum, l) => sum + l.subtotal, 0),
    ...(status === 'pending' ? {} : { resolvedAt: now }),
  };
}

/**
 * Descuenta del catálogo las unidades de una venta y recalcula el estado de cada variante.
 * Nunca deja stock negativo: si se vendió más de lo registrado, queda en 0 (lo real es lo vendido,
 * y el faltante se corrige a mano desde el panel).
 */
export async function applyStockForOrder(
  catalogCollection: Collection,
  order: Order,
  lowStockThreshold: number,
): Promise<void> {
  const doc = await catalogCollection.findOne({ _id: 'catalog' as never });
  if (!doc) return;

  const products = (doc.products ?? []) as CatalogProduct[];
  const updated = products.map((product) => {
    const linesForProduct = order.lines.filter((l) => l.productId === product.id);
    if (linesForProduct.length === 0) return product;

    return {
      ...product,
      variants: product.variants.map((variant) => {
        const sold = linesForProduct
          .filter((l) => l.variantId === variant.id)
          .reduce((sum, l) => sum + l.qty, 0);
        if (sold === 0) return variant;
        const qty = Math.max(0, (variant.stockQty ?? 0) - sold);
        return { ...variant, stockQty: qty, stockStatus: deriveStockStatus(qty, lowStockThreshold) };
      }),
    };
  });

  await catalogCollection.updateOne(
    { _id: 'catalog' as never },
    { $set: { products: updated, updatedAt: new Date().toISOString() } },
  );
}
