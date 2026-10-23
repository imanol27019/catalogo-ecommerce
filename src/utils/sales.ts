import type { Order, SaleChannel } from '../types/order';
import type { Client } from '../types/sales';
import { formatCurrency, plural } from './format';
import { normalizeWhatsapp } from './supplier';
import { sanitizeForWhatsApp } from './whatsapp';

export const CHANNEL_LABELS: Record<SaleChannel, string> = {
  presencial: 'Local',
  tiktok: 'TikTok live',
  whatsapp: 'WhatsApp',
  web: 'Catálogo web',
};

/** Canales que se eligen al cargar una venta a mano. `web` solo entra por el catálogo. */
export const MANUAL_CHANNELS: SaleChannel[] = ['presencial', 'tiktok', 'whatsapp'];

// --- Fechas ----------------------------------------------------------------
// Las ventas se fechan con el día calendario de Argentina (`AAAA-MM-DD`), igual que en el servidor.

const AR_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayAr(): string {
  return AR_DATE.format(new Date());
}

function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Lunes de la semana de `date`: en un comercio la semana arranca el lunes. */
export function startOfWeek(date: string): string {
  const weekday = toUtc(date).getUTCDay();
  return addDays(date, weekday === 0 ? -6 : 1 - weekday);
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: string): string {
  const d = toUtc(startOfMonth(date));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

const WEEKDAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const WEEKDAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** `2026-10-23` → `23/10`. */
export function formatShortDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

/** `2026-10-23` → `vie 23/10`. */
export function formatDayLabel(date: string): string {
  return `${WEEKDAY_SHORT[toUtc(date).getUTCDay()]} ${formatShortDate(date)}`;
}

/** `2026-10` → `oct 2026`. */
export function formatMonthLabel(month: string): string {
  return `${MONTHS_SHORT[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

/** "hoy", "ayer", "hace 3 días": para ver de un vistazo cuánto hace que una reserva espera. */
export function relativeDay(date: string, today = todayAr()): string {
  const diff = daysBetween(date, today);
  if (diff <= 0) return 'hoy';
  if (diff === 1) return 'ayer';
  return `hace ${diff} días`;
}

// --- Cobros ----------------------------------------------------------------

export type PaymentState = 'paid' | 'partial' | 'unpaid';

export function balanceOf(order: Pick<Order, 'total' | 'paidAmount'>): number {
  return Math.max(0, order.total - order.paidAmount);
}

export function paymentStateOf(order: Pick<Order, 'total' | 'paidAmount'>): PaymentState {
  if (order.paidAmount >= order.total) return 'paid';
  return order.paidAmount > 0 ? 'partial' : 'unpaid';
}

// --- Mensajes de WhatsApp ----------------------------------------------------

export function buildWhatsAppChatUrl(number: string | undefined, message: string): string | null {
  const digits = normalizeWhatsapp(number ?? '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Resumen para mandarle a la clienta: qué se llevó, cuánto pagó y cuánto le falta. Después de un
 * live es lo que se le escribe a cada una para que transfiera.
 */
export function buildSaleSummaryMessage(order: Order, businessName: string): string {
  const firstName = sanitizeForWhatsApp(order.customer.name.split(' ')[0] ?? '');
  const lines = order.lines.map((line) => {
    const variant = [line.size, line.color].filter(Boolean).join(' / ');
    return `• ${line.qty}x ${sanitizeForWhatsApp(line.productName)}${variant ? ` (${variant})` : ''} — ${formatCurrency(line.subtotal)}`;
  });
  const balance = balanceOf(order);

  return [
    `Hola${firstName ? ` ${firstName}` : ''}! Te paso el resumen de tu compra en ${businessName} (pedido ${order.code}):`,
    '',
    ...lines,
    '',
    ...(order.discount > 0 ? [`Descuento: −${formatCurrency(order.discount)}`] : []),
    ...(order.shippingCost > 0 ? [`Envío: ${formatCurrency(order.shippingCost)}`] : []),
    `*Total: ${formatCurrency(order.total)}* (${plural(order.itemCount, 'prenda', 'prendas')})`,
    ...(order.paidAmount > 0 ? [`Ya pagaste: ${formatCurrency(order.paidAmount)}`] : []),
    balance > 0 ? `*Te queda por pagar: ${formatCurrency(balance)}*` : '¡Está todo pago! Gracias 💕',
  ].join('\n');
}

// --- Exportar ----------------------------------------------------------------

const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  paid: 'Pagada',
  partial: 'Señada',
  unpaid: 'Sin pagar',
};

const STATUS_LABELS: Record<Order['status'], string> = {
  pending: 'Pedido sin confirmar',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
};

/**
 * Un renglón por prenda vendida, con los datos de la venta repetidos: es el formato que se puede
 * filtrar y sumar en Excel con una tabla dinámica. Separador `;` y BOM para que el Excel en
 * español lo abra con columnas y acentos bien, sin pasar por "importar datos".
 */
export function ordersToCsv(orders: Order[], includeCosts: boolean): string {
  const header = [
    'Fecha',
    'Código',
    'Estado',
    'Canal',
    'Clienta',
    'Vendedora',
    'Producto',
    'Talle',
    'Color',
    'Cantidad',
    'Precio unitario',
    'Subtotal renglón',
    ...(includeCosts ? ['Costo unitario', 'Ganancia renglón'] : []),
    'Descuento venta',
    'Envío venta',
    'Total venta',
    'Cobrado',
    'Saldo',
    'Estado de pago',
    'Medios de pago',
    'Entrega',
  ];

  const rows = orders.flatMap((order) => {
    const methods = [...new Set(order.payments.map((p) => p.methodLabel))].join(' + ');
    const delivery =
      order.delivery.status === 'delivered'
        ? 'Entregada'
        : order.delivery.method === 'shipping'
          ? 'Envío pendiente'
          : 'Retiro pendiente';
    return order.lines.map((line, index) => {
      const isFirst = index === 0;
      return [
        formatShortDate(order.saleDate) + `/${order.saleDate.slice(0, 4)}`,
        order.code,
        STATUS_LABELS[order.status],
        CHANNEL_LABELS[order.channel],
        order.customer.name,
        order.seller ?? '',
        line.productName,
        line.size,
        line.color,
        line.qty,
        line.unitPrice,
        line.subtotal,
        ...(includeCosts
          ? [line.unitCost ?? '', line.unitCost != null ? line.subtotal - line.unitCost * line.qty : '']
          : []),
        // Los importes de la venta van solo en su primer renglón, así sumar la columna da bien.
        isFirst ? order.discount : '',
        isFirst ? order.shippingCost : '',
        isFirst ? order.total : '',
        isFirst ? order.paidAmount : '',
        isFirst ? balanceOf(order) : '',
        PAYMENT_STATE_LABELS[paymentStateOf(order)],
        methods,
        delivery,
      ];
    });
  });

  const escape = (value: string | number) => {
    const text = String(value);
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return '﻿' + [header, ...rows].map((row) => row.map(escape).join(';')).join('\r\n');
}

export function downloadTextFile(content: string, filename: string, mime = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// --- Preferencias del dispositivo ---------------------------------------------
// Cada vendedora usa su celular: recordar su nombre y el último canal ahorra dos toques por venta.

const SELLER_KEY = 'catalogo:vendedora';
const CHANNEL_KEY = 'catalogo:ultimoCanal';

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento (modo privado): simplemente no se recuerda.
  }
}

export function readDeviceSeller(): string {
  return readPref(SELLER_KEY) ?? '';
}

export function rememberDeviceSeller(name: string): void {
  writePref(SELLER_KEY, name);
}

export function readLastChannel(): SaleChannel {
  const value = readPref(CHANNEL_KEY);
  return MANUAL_CHANNELS.includes(value as SaleChannel) ? (value as SaleChannel) : 'presencial';
}

export function rememberLastChannel(channel: SaleChannel): void {
  writePref(CHANNEL_KEY, channel);
}

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

/** Para buscar sin que importen mayúsculas ni tildes. */
export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(DIACRITICS, '').toLowerCase().trim();
}

/** Busca una clienta por nombre, usuario de TikTok o parte del WhatsApp. `needle` ya normalizado. */
export function matchesClient(client: Client, needle: string): boolean {
  const digits = needle.replace(/\D/g, '');
  return (
    normalizeSearch(client.name).includes(needle) ||
    (client.tiktok ?? '').includes(needle.replace(/^@/, '')) ||
    (digits.length >= 3 && (client.whatsapp ?? '').includes(digits))
  );
}

/**
 * Ganancia estimada de una venta: lo cobrado por la mercadería (con el descuento repartido) menos
 * el costo de cada prenda. `null` si alguna prenda no tiene costo cargado: una ganancia parcial
 * se lee como si fuera la total y engaña.
 */
export function estimatedProfit(order: Order): number | null {
  if (order.lines.length === 0 || order.lines.some((l) => l.unitCost == null)) return null;
  const ratio = order.subtotal > 0 ? Math.max(0, order.subtotal - order.discount) / order.subtotal : 1;
  return Math.round(order.lines.reduce((sum, l) => sum + l.subtotal * ratio - (l.unitCost ?? 0) * l.qty, 0));
}
