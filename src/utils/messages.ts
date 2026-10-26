import type { Order } from '../types/order';
import type { MessageTemplates } from '../types/sales';
import { formatCurrency, plural } from './format';
import { balanceOf, carrierName, creditOf, formatDayLabel, isBagOpen } from './sales';
import { sanitizeForWhatsApp } from './whatsapp';

/**
 * Mensajes de WhatsApp para las clientas, armados a partir de una plantilla que la dueña puede
 * editar en Configuración → Ventas.
 *
 * Una regla hace que una sola plantilla sirva para todos los casos: **si una línea usa un dato que
 * esta venta no tiene, esa línea no se manda**. Por ejemplo, "Código de seguimiento: {seguimiento}"
 * desaparece cuando el envío no tiene código, y "Te queda por pagar: {saldo}" cuando está todo pago.
 */

export type MessageKind = keyof MessageTemplates;

export const DEFAULT_TEMPLATES: MessageTemplates = {
  summary: [
    '¡Hola {nombre}! 💕 Te paso el resumen de tu pedido {codigo} en {negocio}:',
    '',
    '{detalle}',
    '',
    'Descuento: -{descuento}',
    'Envío: {envio}',
    '*Total: {total}* ({prendas})',
    'Ya pagaste: {pagado}',
    '*Te queda por pagar: {saldo}*',
    'Tenés {a_favor} a favor para seguir sumando prendas.',
    'Tu bolsa queda abierta hasta el {cierre_bolsa}.',
    '',
    '¡Gracias por elegirnos!',
  ].join('\n'),
  dispatch: [
    '¡Hola {nombre}! 💕',
    '¡Tu pedido {codigo} ya fue despachado! 📦',
    '',
    'Sale por {transporte}.',
    'Código de seguimiento: {seguimiento}',
    'Envío: {pago_envio}',
    '',
    '¡Gracias por comprar en {negocio}! Cualquier duda, escribinos.',
  ].join('\n'),
};

export const MESSAGE_LABELS: Record<MessageKind, { title: string; hint: string }> = {
  summary: {
    title: 'Resumen del pedido',
    hint: 'Lo que se manda con el botón “Resumen”: qué se lleva, cuánto pagó y cuánto le falta.',
  },
  dispatch: {
    title: 'Aviso de despacho',
    hint: 'Lo que se manda al marcar “Despacho realizado” por un transporte.',
  },
};

/** Los datos que se pueden usar en las plantillas, con lo que se reemplaza cada uno. */
export const MESSAGE_VARIABLES: { key: string; description: string }[] = [
  { key: 'nombre', description: 'Nombre de la clienta (solo el primero)' },
  { key: 'negocio', description: 'Nombre del negocio' },
  { key: 'codigo', description: 'Código del pedido' },
  { key: 'detalle', description: 'Lista de prendas con cantidades y precios' },
  { key: 'prendas', description: 'Cantidad de prendas (ej: “7 prendas”)' },
  { key: 'total', description: 'Total a pagar' },
  { key: 'descuento', description: 'Descuento (si hubo)' },
  { key: 'envio', description: 'Envío cobrado (si hubo)' },
  { key: 'pagado', description: 'Lo que ya pagó (si pagó algo)' },
  { key: 'saldo', description: 'Lo que le falta pagar (si debe)' },
  { key: 'a_favor', description: 'Lo que tiene a favor en una bolsa (si señó de más)' },
  { key: 'cierre_bolsa', description: 'Hasta cuándo está abierta su bolsa (si tiene una abierta)' },
  { key: 'transporte', description: 'Por dónde se despachó (Andreani, Vía Cargo…)' },
  { key: 'seguimiento', description: 'Código de seguimiento (si tiene)' },
  { key: 'pago_envio', description: '“ya está pago” o “lo pagás al recibirlo”' },
];

function money(value: number): string {
  return value > 0 ? formatCurrency(value) : '';
}

/** Valor de cada dato para una venta. Vacío = esta venta no lo tiene (y su línea no se manda). */
export function messageValues(order: Order, businessName: string): Record<string, string> {
  const dispatchedByCarrier =
    order.delivery.status === 'delivered' && Boolean(order.delivery.carrier) && order.delivery.carrier !== 'local';

  return {
    nombre: sanitizeForWhatsApp(order.customer.name.trim().split(/\s+/)[0] ?? ''),
    negocio: businessName,
    codigo: order.code,
    detalle: order.lines
      .map((line) => {
        const variant = [line.size, line.color].filter(Boolean).join(' / ');
        return `• ${line.qty}x ${sanitizeForWhatsApp(line.productName)}${variant ? ` (${variant})` : ''} — ${formatCurrency(line.subtotal)}`;
      })
      .join('\n'),
    prendas: order.itemCount > 0 ? plural(order.itemCount, 'prenda', 'prendas') : '',
    total: formatCurrency(order.total),
    descuento: money(order.discount),
    envio: money(order.shippingCost),
    pagado: money(order.paidAmount),
    saldo: money(balanceOf(order)),
    a_favor: money(creditOf(order)),
    cierre_bolsa: isBagOpen(order) && order.bag ? formatDayLabel(order.bag.closesOn) : '',
    transporte: dispatchedByCarrier ? sanitizeForWhatsApp(carrierName(order.delivery)) : '',
    seguimiento: dispatchedByCarrier ? sanitizeForWhatsApp(order.delivery.trackingCode ?? '') : '',
    pago_envio: !dispatchedByCarrier
      ? ''
      : order.delivery.shippingPayment === 'on_delivery'
        ? 'lo pagás al recibirlo'
        : order.delivery.shippingPayment === 'prepaid'
          ? 'ya está pago'
          : '',
  };
}

const VARIABLE = /\{([a-z_]+)\}/g;

/**
 * Reemplaza los datos de la plantilla. Las líneas con un dato vacío se sacan enteras, y los
 * renglones en blanco que quedan repetidos se juntan en uno.
 */
export function renderTemplate(template: string, values: Record<string, string>): string {
  const lines = template.replace(/\r\n/g, '\n').split('\n');
  const kept: string[] = [];
  for (const line of lines) {
    const used = [...line.matchAll(VARIABLE)].map((m) => m[1]).filter((key) => key in values);
    if (used.some((key) => !values[key])) continue;
    kept.push(line.replace(VARIABLE, (match, key: string) => (key in values ? values[key] : match)));
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function templateFor(kind: MessageKind, templates: Partial<MessageTemplates> | undefined): string {
  return templates?.[kind]?.trim() ? templates[kind]! : DEFAULT_TEMPLATES[kind];
}

export function buildCustomerMessage(
  kind: MessageKind,
  order: Order,
  businessName: string,
  templates: Partial<MessageTemplates> | undefined,
): string {
  return renderTemplate(templateFor(kind, templates), messageValues(order, businessName));
}

/** El aviso de despacho tiene sentido cuando salió por un transporte, no si se entregó en mano. */
export function canSendDispatchNotice(order: Order): boolean {
  return order.status === 'confirmed' && order.delivery.status === 'delivered' && order.delivery.carrier !== 'local';
}

/** Venta de ejemplo para la vista previa de las plantillas en Configuración. */
export const SAMPLE_ORDER: Order = {
  id: 'ejemplo',
  code: 'K7QX',
  createdAt: '2026-10-24T15:00:00.000Z',
  saleDate: '2026-10-24',
  status: 'confirmed',
  channel: 'tiktok',
  customer: { name: 'Juli Mayorista', locality: 'Lanús', shippingMethodLabel: '' },
  lines: [
    { productId: 'a', productName: 'Sweater con encaje', variantId: 'a1', size: 'Único', color: 'Negro', qty: 3, unitPrice: 13000, listPrice: 13000, subtotal: 39000 },
    { productId: 'b', productName: 'Calza animal print', variantId: 'b1', size: 'M', color: 'Animal', qty: 2, unitPrice: 6000, listPrice: 6000, subtotal: 12000 },
  ],
  itemCount: 5,
  subtotal: 51000,
  discount: 0,
  shippingCost: 0,
  total: 51000,
  payments: [],
  paidAmount: 20000,
  delivery: {
    method: 'shipping',
    status: 'delivered',
    deliveredAt: '2026-10-25',
    carrier: 'andreani',
    trackingCode: '360002123456',
    shippingPayment: 'on_delivery',
  },
};
