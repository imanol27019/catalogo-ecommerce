import type { OrderMinimumStatus } from '../../utils/orderMinimum';
import { formatCurrency } from '../../utils/format';

export function OrderMinimumNotice({ status }: { status: OrderMinimumStatus }) {
  if (status.isMet) return null;

  const parts: string[] = [];
  if (status.qtyThresholdActive) parts.push(`${status.qtyRemaining} prendas`);
  if (status.amountThresholdActive) parts.push(formatCurrency(status.amountRemaining));

  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm text-brand-800">
      <p className="font-semibold">Todavía no llegás al mínimo de compra mayorista.</p>
      <p className="mt-0.5">Te faltan {parts.join(' o ')} para poder finalizar el pedido por WhatsApp.</p>
    </div>
  );
}
