import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { isIsoDate, toArDate } from './dates';
import type { Client } from './clients';
import type { PaymentMethod } from './salesConfig';

export type OrderStatus = 'pending' | 'confirmed' | 'cancelled';

/** Por dónde entró la venta. `web` es el pedido armado en el catálogo, que llega por WhatsApp. */
export type SaleChannel = 'presencial' | 'tiktok' | 'whatsapp' | 'web';
export const SALE_CHANNELS: readonly SaleChannel[] = ['presencial', 'tiktok', 'whatsapp', 'web'];

export type DeliveryMethod = 'pickup' | 'shipping';
export type DeliveryStatus = 'pending' | 'delivered';

export interface OrderLine {
  /** Vacío en un artículo fuera del catálogo: no tiene stock que mover. */
  productId: string;
  productName: string;
  variantId: string;
  size: string;
  color: string;
  qty: number;
  unitPrice: number;
  /** Lo que correspondía según el catálogo. Si difiere de `unitPrice`, se cobró un precio especial. */
  listPrice: number;
  subtotal: number;
  /** Costo por unidad al momento de la venta. Solo lo ve la administradora. */
  unitCost?: number;
}

export interface OrderCustomer {
  name: string;
  locality: string;
  shippingMethodLabel: string;
  comment?: string;
}

export interface SalePayment {
  id: string;
  /** Fecha del cobro (AAAA-MM-DD). Una seña y el saldo pueden caer en días distintos. */
  date: string;
  amount: number;
  methodId: string;
  /** Copia del nombre del medio al momento del cobro, por si después se renombra o se borra. */
  methodLabel: string;
  note?: string;
  createdAt: string;
}

export interface OrderDelivery {
  method: DeliveryMethod;
  status: DeliveryStatus;
  deliveredAt?: string;
  /** Transporte, número de seguimiento, quién retira… */
  note?: string;
}

export interface Order {
  id: string;
  /** Código corto y legible para nombrar la venta al hablar con la clienta. */
  code: string;
  createdAt: string;
  updatedAt?: string;
  /** Día de la venta (AAAA-MM-DD, Argentina). Es la fecha que usan los reportes. */
  saleDate: string;
  status: OrderStatus;
  channel: SaleChannel;
  customer: OrderCustomer;
  clientId?: string;
  /** Vendedora que la cargó. */
  seller?: string;
  lines: OrderLine[];
  itemCount: number;
  /** Suma de los renglones, antes del descuento y del envío. */
  subtotal: number;
  discount: number;
  shippingCost: number;
  /** Lo que paga la clienta: subtotal − descuento + envío. */
  total: number;
  payments: SalePayment[];
  paidAmount: number;
  delivery: OrderDelivery;
  notes?: string;
  /** Cuándo se confirmó (y por lo tanto cuándo se descontó el stock). */
  resolvedAt?: string;
  cancelledAt?: string;
}

/** Topes defensivos: el endpoint de pedidos web es público, así que no puede aceptar cualquier cosa. */
const MAX_LINES = 80;
const MAX_QTY_PER_LINE = 9999;
const MAX_AMOUNT = 100_000_000;

export class OrderValidationError extends Error {}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function amount(value: unknown): number | null {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 && n <= MAX_AMOUNT ? n : null;
}

export interface CatalogProduct {
  id: string;
  name: string;
  category?: string;
  unitPrice: number;
  salePrice?: number;
  bulkPricing?: { minQty: number; price: number }[];
  variants: { id: string; size: string; color: string; stockQty: number }[];
}

/**
 * Precio unitario que corresponde a `productQty` unidades del producto.
 * `productQty` son las unidades del producto ENTERO en el pedido, sumando todos sus talles y
 * colores — no las de un solo renglón. Tiene que coincidir con `unitPriceForQty` del navegador.
 */
function effectiveUnitPrice(product: CatalogProduct, productQty: number): number {
  const base =
    typeof product.salePrice === 'number' && product.salePrice < product.unitPrice
      ? product.salePrice
      : product.unitPrice;
  if (!product.bulkPricing?.length) return base;
  const tier = [...product.bulkPricing]
    .sort((a, b) => a.minQty - b.minQty)
    .filter((t) => productQty >= t.minQty)
    .pop();
  return tier ? tier.price : base;
}

interface ResolveLinesOptions {
  /** Solo el panel puede poner un precio distinto al de lista o cargar artículos sueltos. */
  allowOverrides: boolean;
  costs?: Record<string, number>;
  previousLines?: OrderLine[];
}

/**
 * Arma los renglones a partir del catálogo real. Los precios de lista NUNCA vienen del navegador:
 * se recalculan acá, así un pedido manipulado no puede alterar los importes.
 *
 * Primero se valida cada renglón y se acumulan las unidades por producto; recién después se
 * calcula el precio. El escalón por cantidad se resuelve sobre el total del producto (sumando sus
 * talles y colores), así que no se puede saber el precio de un renglón hasta haber leído todos.
 */
function resolveLines(linesRaw: unknown, products: CatalogProduct[], options: ResolveLinesOptions): OrderLine[] {
  const rawList = Array.isArray(linesRaw) ? (linesRaw as Record<string, unknown>[]) : [];
  if (rawList.length === 0) throw new OrderValidationError('La venta no tiene productos.');
  if (rawList.length > MAX_LINES) throw new OrderValidationError('La venta tiene demasiados renglones.');

  type Pending =
    | { kind: 'catalog'; product: CatalogProduct; variant: CatalogProduct['variants'][number]; qty: number; override: number | null }
    | { kind: 'free'; name: string; qty: number; price: number; cost: number | null };

  const pending: Pending[] = [];
  const qtyPorProducto = new Map<string, number>();

  for (const raw of rawList) {
    const qty = Math.floor(Number(raw.qty));
    const productId = text(raw.productId, 120);

    if (!productId) {
      // Artículo fuera del catálogo: algo que se vende sin estar cargado (una prenda suelta, un
      // saldo). No mueve stock, pero entra en la venta y en los reportes.
      if (!options.allowOverrides) throw new OrderValidationError('Producto inexistente.');
      const name = text(raw.name, 80);
      const price = amount(raw.unitPrice);
      if (!name) throw new OrderValidationError('Falta el nombre del artículo fuera del catálogo.');
      if (price === null) throw new OrderValidationError(`Falta el precio de "${name}".`);
      if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
        throw new OrderValidationError(`Cantidad inválida para ${name}.`);
      }
      pending.push({ kind: 'free', name, qty, price, cost: amount(raw.unitCost) || null });
      continue;
    }

    const product = products.find((p) => p.id === productId);
    if (!product) throw new OrderValidationError(`Producto inexistente: ${productId}`);
    const variant = product.variants.find((v) => v.id === raw.variantId);
    if (!variant) throw new OrderValidationError(`Talle/color inexistente en ${product.name}.`);
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      throw new OrderValidationError(`Cantidad inválida para ${product.name}.`);
    }

    // Un mismo talle/color repetido se suma en un solo renglón.
    const repeated = pending.find((p) => p.kind === 'catalog' && p.variant.id === variant.id && p.product.id === product.id);
    if (repeated && repeated.kind === 'catalog') {
      repeated.qty += qty;
    } else {
      const override = options.allowOverrides && raw.unitPrice !== undefined && raw.unitPrice !== null ? amount(raw.unitPrice) : null;
      pending.push({ kind: 'catalog', product, variant, qty, override });
    }
    qtyPorProducto.set(product.id, (qtyPorProducto.get(product.id) ?? 0) + qty);
  }

  return pending.map((item, index): OrderLine => {
    if (item.kind === 'free') {
      return {
        productId: '',
        productName: item.name,
        variantId: `libre-${index + 1}`,
        size: '',
        color: '',
        qty: item.qty,
        unitPrice: item.price,
        listPrice: item.price,
        subtotal: item.price * item.qty,
        ...(item.cost ? { unitCost: item.cost } : {}),
      };
    }

    const listPrice = effectiveUnitPrice(item.product, qtyPorProducto.get(item.product.id) ?? item.qty);
    const unitPrice = item.override ?? listPrice;
    const previous = options.previousLines?.find(
      (l) => l.productId === item.product.id && l.variantId === item.variant.id,
    );
    const cost = options.costs?.[item.product.id] ?? previous?.unitCost;

    return {
      productId: item.product.id,
      productName: item.product.name,
      variantId: item.variant.id,
      size: item.variant.size,
      color: item.variant.color,
      qty: item.qty,
      unitPrice,
      listPrice,
      subtotal: unitPrice * item.qty,
      ...(typeof cost === 'number' && cost > 0 ? { unitCost: cost } : {}),
    };
  });
}

/** Recalcula los totales derivados. Se llama después de cualquier cambio en renglones o cobros. */
export function withTotals(order: Omit<Order, 'itemCount' | 'subtotal' | 'total' | 'paidAmount'>): Order {
  const subtotal = order.lines.reduce((sum, l) => sum + l.subtotal, 0);
  const discount = Math.min(order.discount, subtotal);
  return {
    ...order,
    discount,
    itemCount: order.lines.reduce((sum, l) => sum + l.qty, 0),
    subtotal,
    total: Math.max(0, subtotal - discount + order.shippingCost),
    paidAmount: order.payments.reduce((sum, p) => sum + p.amount, 0),
  };
}

function deliveryMethodFromLabel(label: string): DeliveryMethod {
  return /retir/i.test(label) ? 'pickup' : 'shipping';
}

/** Pedido armado por una clienta en el catálogo web. Queda pendiente hasta que el negocio lo confirme. */
export function buildWebOrder(payload: unknown, products: CatalogProduct[], code: string): Order {
  const body = (payload ?? {}) as Record<string, unknown>;
  const customerRaw = (body.customer ?? {}) as Record<string, unknown>;

  const name = text(customerRaw.name, 120);
  if (!name) throw new OrderValidationError('Falta el nombre de quien compra.');

  const lines = resolveLines(body.lines, products, { allowOverrides: false });
  const shippingMethodLabel = text(customerRaw.shippingMethodLabel, 120);
  const comment = text(customerRaw.comment, 500);
  const now = new Date().toISOString();

  return withTotals({
    id: randomUUID(),
    code,
    createdAt: now,
    saleDate: toArDate(now),
    status: 'pending',
    channel: 'web',
    customer: {
      name,
      locality: text(customerRaw.locality, 120),
      shippingMethodLabel,
      ...(comment ? { comment } : {}),
    },
    lines,
    discount: 0,
    shippingCost: 0,
    payments: [],
    delivery: { method: deliveryMethodFromLabel(shippingMethodLabel), status: 'pending' },
  });
}

export function buildPayment(raw: unknown, methods: PaymentMethod[], fallbackDate: string): SalePayment {
  const body = (raw ?? {}) as Record<string, unknown>;
  const value = amount(body.amount);
  if (!value) throw new OrderValidationError('El monto del cobro tiene que ser mayor a cero.');
  const method = methods.find((m) => m.id === body.methodId);
  if (!method) throw new OrderValidationError('Elegí con qué medio pagó.');
  const note = text(body.note, 200);
  return {
    id: randomUUID(),
    date: isIsoDate(body.date) ? body.date : fallbackDate,
    amount: value,
    methodId: method.id,
    methodLabel: method.label,
    ...(note ? { note } : {}),
    createdAt: new Date().toISOString(),
  };
}

function buildDelivery(raw: unknown, fallback: OrderDelivery, saleDate: string): OrderDelivery {
  const body = (raw ?? {}) as Record<string, unknown>;
  const method: DeliveryMethod = body.method === 'pickup' || body.method === 'shipping' ? body.method : fallback.method;
  const status: DeliveryStatus = body.status === 'pending' || body.status === 'delivered' ? body.status : fallback.status;
  const note = text(body.note, 200);
  return {
    method,
    status,
    ...(status === 'delivered'
      ? { deliveredAt: isIsoDate(body.deliveredAt) ? body.deliveredAt : (fallback.deliveredAt ?? saleDate) }
      : {}),
    ...(note ? { note } : {}),
  };
}

export interface SaleContext {
  products: CatalogProduct[];
  costs: Record<string, number>;
  paymentMethods: PaymentMethod[];
  /** Ficha de la clienta, si la venta está vinculada a una. */
  client: Client | null;
}

/**
 * Venta cargada desde el panel (local, live de TikTok, WhatsApp) o edición de una existente.
 * Al crear entra confirmada: el stock se descuenta en el momento, que es lo que evita vender dos
 * veces la misma prenda durante un live. Al editar se conservan los cobros (tienen sus propias
 * rutas) y el estado.
 */
export function buildSale(payload: unknown, ctx: SaleContext, base: { code: string } | Order): Order {
  const body = (payload ?? {}) as Record<string, unknown>;
  const existing = 'id' in base ? base : null;
  const now = new Date().toISOString();

  const channel = SALE_CHANNELS.includes(body.channel as SaleChannel)
    ? (body.channel as SaleChannel)
    : (existing?.channel ?? 'presencial');
  const saleDate = isIsoDate(body.saleDate) ? body.saleDate : (existing?.saleDate ?? toArDate(now));

  const lines = resolveLines(body.lines, ctx.products, {
    allowOverrides: true,
    costs: ctx.costs,
    previousLines: existing?.lines,
  });

  const customerRaw = (body.customer ?? {}) as Record<string, unknown>;
  const fallbackName = channel === 'presencial' ? 'Venta en el local' : 'Sin nombre';
  // El comentario lo escribe la clienta en el catálogo web: al editar el pedido se conserva.
  const comment = text(customerRaw.comment, 500) || existing?.customer.comment || '';
  const customer: OrderCustomer = {
    name: ctx.client?.name ?? (text(customerRaw.name, 120) || existing?.customer.name || fallbackName),
    locality: ctx.client?.locality ?? text(customerRaw.locality, 120),
    shippingMethodLabel: text(customerRaw.shippingMethodLabel, 120) || existing?.customer.shippingMethodLabel || '',
    ...(comment ? { comment } : {}),
  };

  const defaultDelivery: OrderDelivery =
    existing?.delivery ??
    (channel === 'presencial' ? { method: 'pickup', status: 'delivered' } : { method: 'shipping', status: 'pending' });
  const delivery = buildDelivery(body.delivery, defaultDelivery, saleDate);

  const payments = existing
    ? existing.payments
    : (Array.isArray(body.payments) ? body.payments : []).map((p) => buildPayment(p, ctx.paymentMethods, saleDate));

  const seller = text(body.seller, 40);
  const notes = text(body.notes, 1000);
  const discount = amount(body.discount) ?? 0;
  const shippingCost = delivery.method === 'shipping' ? (amount(body.shippingCost) ?? 0) : 0;

  const order = withTotals({
    id: existing?.id ?? randomUUID(),
    code: base.code,
    createdAt: existing?.createdAt ?? now,
    ...(existing ? { updatedAt: now } : {}),
    saleDate,
    status: existing?.status ?? 'confirmed',
    channel,
    customer,
    ...(ctx.client ? { clientId: ctx.client.id } : {}),
    ...(seller ? { seller } : {}),
    lines,
    discount,
    shippingCost,
    payments,
    delivery,
    ...(notes ? { notes } : {}),
    ...(existing?.resolvedAt ? { resolvedAt: existing.resolvedAt } : existing ? {} : { resolvedAt: now }),
    ...(existing?.cancelledAt ? { cancelledAt: existing.cancelledAt } : {}),
  });

  if (order.paidAmount > order.total) {
    throw new OrderValidationError('Lo cobrado supera el total de la venta. Revisá los montos.');
  }
  return order;
}

/**
 * Las ventas guardadas antes de este sistema no tienen canal, cobros ni entrega. Se completan con
 * lo que se puede deducir: las manuales eran ventas de mostrador ya cobradas y entregadas; las
 * del sitio, pedidos web. Se corre una vez al arrancar y el resultado se guarda.
 */
export function normalizeLegacyOrder(doc: Record<string, unknown>): Order {
  const raw = doc as unknown as Partial<Order> & { source?: string; total?: number };
  const lines: OrderLine[] = (raw.lines ?? []).map((l) => ({ ...l, listPrice: l.listPrice ?? l.unitPrice }));
  const saleDate = raw.saleDate ?? toArDate(raw.createdAt ?? new Date().toISOString());
  const channel: SaleChannel = raw.channel ?? (raw.source === 'manual' ? 'presencial' : 'web');
  const isConfirmed = raw.status === 'confirmed';
  const total = raw.total ?? lines.reduce((s, l) => s + l.subtotal, 0);

  const payments: SalePayment[] =
    raw.payments ??
    (isConfirmed
      ? [
          {
            id: `historico-${raw.id}`,
            date: saleDate,
            amount: total,
            methodId: 'sin-dato',
            methodLabel: 'Sin dato (venta anterior)',
            createdAt: raw.resolvedAt ?? raw.createdAt ?? new Date().toISOString(),
          },
        ]
      : []);

  const shippingLabel = raw.customer?.shippingMethodLabel ?? '';
  return withTotals({
    id: raw.id ?? randomUUID(),
    code: raw.code ?? '----',
    createdAt: raw.createdAt ?? new Date().toISOString(),
    ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}),
    saleDate,
    status: raw.status ?? 'pending',
    channel,
    customer: raw.customer ?? { name: 'Sin nombre', locality: '', shippingMethodLabel: '' },
    ...(raw.clientId ? { clientId: raw.clientId } : {}),
    ...(raw.seller ? { seller: raw.seller } : {}),
    lines,
    discount: raw.discount ?? 0,
    shippingCost: raw.shippingCost ?? 0,
    payments,
    delivery:
      raw.delivery ??
      (isConfirmed
        ? { method: deliveryMethodFromLabel(shippingLabel), status: 'delivered', deliveredAt: saleDate }
        : { method: deliveryMethodFromLabel(shippingLabel), status: 'pending' }),
    ...(raw.notes ? { notes: raw.notes } : {}),
    ...(raw.resolvedAt ? { resolvedAt: raw.resolvedAt } : {}),
    ...(raw.cancelledAt ? { cancelledAt: raw.cancelledAt } : {}),
  });
}

/** Código corto, sin letras que se confunden al dictarlo (O/0, I/1). Se reintenta si ya existe. */
export async function generateOrderCode(ordersCollection: Collection): Promise<string> {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    if (!(await ordersCollection.findOne({ code }, { projection: { _id: 1 } }))) return code;
  }
  return randomUUID().slice(0, 6).toUpperCase();
}

// --- Stock ---------------------------------------------------------------

export interface StockChange {
  productId: string;
  variantId: string;
  /** Negativo = sale del stock (venta). Positivo = vuelve al stock (cancelación o devolución). */
  delta: number;
}

function unitsByVariant(lines: OrderLine[]): Map<string, { productId: string; variantId: string; qty: number }> {
  const map = new Map<string, { productId: string; variantId: string; qty: number }>();
  for (const line of lines) {
    if (!line.productId) continue;
    const key = `${line.productId}::${line.variantId}`;
    const current = map.get(key);
    if (current) current.qty += line.qty;
    else map.set(key, { productId: line.productId, variantId: line.variantId, qty: line.qty });
  }
  return map;
}

/**
 * Cuánto stock mover al pasar de `before` a `after` (ambos ya descontados o no). Sirve para las
 * tres operaciones: confirmar (before vacío), cancelar (after vacío) y editar una venta ya hecha
 * (solo se mueve la diferencia).
 */
export function stockChangesBetween(before: OrderLine[], after: OrderLine[]): StockChange[] {
  const previous = unitsByVariant(before);
  const next = unitsByVariant(after);
  const keys = new Set([...previous.keys(), ...next.keys()]);
  const changes: StockChange[] = [];
  for (const key of keys) {
    const ref = next.get(key) ?? previous.get(key)!;
    const delta = (previous.get(key)?.qty ?? 0) - (next.get(key)?.qty ?? 0);
    if (delta !== 0) changes.push({ productId: ref.productId, variantId: ref.variantId, delta });
  }
  return changes;
}

/**
 * Mueve el stock con `$inc` atómico en la base, sin leer y reescribir el catálogo entero. Con
 * varias vendedoras cargando ventas a la vez (un live, el local), leer-modificar-guardar hacía que
 * una venta pisara el descuento de la otra.
 *
 * Después se aplica un piso de 0: si se vendió más de lo registrado, lo real es lo vendido y el
 * faltante se corrige a mano desde el panel. El estado (en stock / poco / sin stock) se deriva de
 * las unidades al leer el catálogo, así que no hace falta tocarlo acá.
 */
export async function applyStockChanges(catalogCollection: Collection, changes: StockChange[]): Promise<void> {
  const relevant = changes.filter((c) => c.productId && c.delta !== 0);
  if (relevant.length === 0) return;

  const inc: Record<string, number> = {};
  const floor: Record<string, number> = {};
  const arrayFilters: Record<string, string>[] = [];
  const productIds = [...new Set(relevant.map((c) => c.productId))];

  productIds.forEach((productId, pi) => {
    arrayFilters.push({ [`p${pi}.id`]: productId });
    relevant
      .filter((c) => c.productId === productId)
      .forEach((change, vi) => {
        const ident = `v${pi}x${vi}`;
        arrayFilters.push({ [`${ident}.id`]: change.variantId });
        const path = `products.$[p${pi}].variants.$[${ident}].stockQty`;
        inc[path] = change.delta;
        floor[path] = 0;
      });
  });

  await catalogCollection.updateOne(
    { _id: 'catalog' as never },
    { $inc: inc, $set: { updatedAt: new Date().toISOString() } },
    { arrayFilters },
  );
  await catalogCollection.updateOne({ _id: 'catalog' as never }, { $max: floor }, { arrayFilters });
}
