import { formatCurrency } from './format';

export interface OrderMinimumStatus {
  isMet: boolean;
  qtyThresholdActive: boolean;
  amountThresholdActive: boolean;
  qtyRemaining: number;
  amountRemaining: number;
}

/**
 * Mínimo para poder finalizar el pedido: cantidad de prendas O monto total (no ambos a la vez).
 * Un umbral en 0 significa "desactivado" y no cuenta como requisito.
 */
export function evaluateOrderMinimum(
  totalQty: number,
  totalAmount: number,
  minOrderQty: number,
  minOrderTotal: number,
): OrderMinimumStatus {
  const qtyThresholdActive = minOrderQty > 0;
  const amountThresholdActive = minOrderTotal > 0;
  const qtyMet = qtyThresholdActive && totalQty >= minOrderQty;
  const amountMet = amountThresholdActive && totalAmount >= minOrderTotal;

  return {
    isMet: (!qtyThresholdActive && !amountThresholdActive) || qtyMet || amountMet,
    qtyThresholdActive,
    amountThresholdActive,
    qtyRemaining: qtyThresholdActive ? Math.max(0, minOrderQty - totalQty) : 0,
    amountRemaining: amountThresholdActive ? Math.max(0, minOrderTotal - totalAmount) : 0,
  };
}

export function describeOrderMinimum(minOrderQty: number, minOrderTotal: number): string | undefined {
  const parts: string[] = [];
  if (minOrderQty > 0) parts.push(`${minOrderQty} prendas`);
  if (minOrderTotal > 0) parts.push(formatCurrency(minOrderTotal));
  if (parts.length === 0) return undefined;
  return `Compra mínima: ${parts.join(' o ')} — Venta exclusiva mayorista`;
}
