import type { CartLineItem, CartTotals } from '../types/cart';
import type { OrderFormData } from '../types/order';
import type { CartValidationResult } from './validation';
import { BUSINESS_NAME, MAX_WHATSAPP_MESSAGE_LENGTH, SHIPPING_METHODS, WHATSAPP_NUMBER } from '../config/site.config';
import { computeLineUnitPrice } from './pricing';
import { formatCurrency } from './format';

/** Quita `* _ ~` de texto libre para que no rompa el formato de negrita/itálica de WhatsApp. */
export function sanitizeForWhatsApp(text: string): string {
  return text.replace(/[*_~]/g, '');
}

function resolveShippingLabel(shippingMethodId: string): string {
  return SHIPPING_METHODS.find((m) => m.id === shippingMethodId)?.label ?? shippingMethodId;
}

export function buildOrderMessage(
  order: OrderFormData,
  items: CartLineItem[],
  totals: CartTotals,
  validation: CartValidationResult,
): string {
  const header = [
    `*Nuevo pedido - ${BUSINESS_NAME}*`,
    '',
    `*Cliente:* ${sanitizeForWhatsApp(order.contactName)}`,
    `*Localidad/Zona:* ${sanitizeForWhatsApp(order.locality)}`,
    `*Método de envío:* ${resolveShippingLabel(order.shippingMethodId)}`,
    ...(order.comment?.trim() ? [`*Comentario:* ${sanitizeForWhatsApp(order.comment.trim())}`] : []),
    '',
    '*Detalle del pedido:*',
  ];

  const itemGroups = items.map((item, idx) => {
    const unitPrice = computeLineUnitPrice(item);
    return [
      `${idx + 1}. ${item.productName} - Talle ${item.size} / Color ${item.color}`,
      `   Cantidad: ${item.qty} u. x ${formatCurrency(unitPrice)} = ${formatCurrency(unitPrice * item.qty)}`,
    ];
  });

  const footer = [
    '',
    `*Total: ${formatCurrency(totals.grandTotal)}* (${totals.itemCount} unidades)`,
    ...(validation.allMessages.length
      ? ['', 'Atención - cantidades a confirmar:', ...validation.allMessages.map((m) => `- ${m}`)]
      : []),
    '',
    'Pedido generado desde el catálogo web.',
  ];

  function assemble(groups: string[][], truncatedCount: number): string {
    const truncationNote =
      truncatedCount > 0
        ? [`...y ${truncatedCount} producto${truncatedCount === 1 ? '' : 's'} más — el detalle completo está en el carrito.`]
        : [];
    return [...header, ...groups.flat(), ...truncationNote, ...footer].join('\n');
  }

  let groups = itemGroups;
  let truncated = 0;
  let message = assemble(groups, truncated);
  while (message.length > MAX_WHATSAPP_MESSAGE_LENGTH && groups.length > 0) {
    groups = groups.slice(0, -1);
    truncated++;
    message = assemble(groups, truncated);
  }
  return message;
}

/**
 * Arma la URL de wa.me. `encodeURIComponent` se aplica una sola vez sobre el mensaje ya armado
 * (nunca línea por línea) para no romper los saltos de línea con un doble encoding.
 */
export function buildWhatsAppUrl(message: string, number: string = WHATSAPP_NUMBER): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
