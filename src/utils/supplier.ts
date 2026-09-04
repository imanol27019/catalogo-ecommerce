import type { Supplier } from '../types/supplier';

/** Deja el número listo para `wa.me`: solo dígitos. */
export function normalizeWhatsapp(value: string): string {
  return value.replace(/\D/g, '');
}

export function buildSupplierWhatsAppUrl(supplier: Supplier, message?: string): string | null {
  const number = normalizeWhatsapp(supplier.whatsapp ?? '');
  if (!number) return null;
  const base = `https://wa.me/${number}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Mensaje de reposición prearmado, que es para lo que se abre el chat el 99% de las veces. */
export function buildRestockMessage(businessName: string, productName: string, detail?: string): string {
  const partes = [`Hola! Te escribo de ${businessName}.`, `Necesito reponer: ${productName}.`];
  if (detail) partes.push(detail);
  partes.push('¿Tenés disponibilidad?');
  return partes.join('\n');
}
