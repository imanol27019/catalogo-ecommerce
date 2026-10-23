import { useState } from 'react';
import type { Order } from '../../types/order';
import { BUSINESS_NAME } from '../../config/site.config';
import { formatCurrency } from '../../utils/format';
import {
  balanceOf,
  buildSaleSummaryMessage,
  buildWhatsAppChatUrl,
  CHANNEL_LABELS,
  estimatedProfit,
  formatDayLabel,
  formatShortDate,
  paymentStateOf,
  relativeDay,
} from '../../utils/sales';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { WhatsAppIcon } from '../ui/icons';

export type SaleAction = 'pay' | 'deliver' | 'confirm' | 'cancel' | 'edit';

interface SaleCardProps {
  order: Order;
  /** WhatsApp de la clienta (de su ficha), para mandarle el resumen. */
  whatsapp?: string;
  isAdmin: boolean;
  isBusy: boolean;
  onAction: (order: Order, action: SaleAction) => void;
  onDeletePayment?: (order: Order, paymentId: string) => void;
}

const VISIBLE_LINES = 4;

export function SaleCard({ order, whatsapp, isAdmin, isBusy, onAction, onDeletePayment }: SaleCardProps) {
  const [showAllLines, setShowAllLines] = useState(false);
  const balance = balanceOf(order);
  const payment = paymentStateOf(order);
  const isPending = order.status === 'pending';
  const isCancelled = order.status === 'cancelled';
  const isConfirmed = order.status === 'confirmed';
  const awaitingDelivery = isConfirmed && order.delivery.status === 'pending';
  const profit = isAdmin && isConfirmed ? estimatedProfit(order) : null;
  const lines = showAllLines ? order.lines : order.lines.slice(0, VISIBLE_LINES);
  const whatsappUrl = !isCancelled ? buildWhatsAppChatUrl(whatsapp, buildSaleSummaryMessage(order, BUSINESS_NAME)) : null;

  return (
    <article
      className={`rounded-xl border bg-white p-3 ${isCancelled ? 'border-stone-200 opacity-75' : 'border-stone-200'}`}
      aria-label={`Venta ${order.code} de ${order.customer.name}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading text-sm font-semibold text-stone-900">
            {order.customer.name} <span className="font-normal text-stone-600">· {order.code}</span>
          </p>
          <p className="text-xs text-stone-600">
            {CHANNEL_LABELS[order.channel]} · {formatDayLabel(order.saleDate)}
            {order.seller && ` · ${order.seller}`}
            {order.customer.locality && ` · ${order.customer.locality}`}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {isPending && <Badge tone="stock-low">Pedido web sin confirmar</Badge>}
          {isCancelled && <Badge tone="stock-out">Cancelada</Badge>}
          {isConfirmed && payment === 'paid' && <Badge tone="stock-in">Pagada</Badge>}
          {isConfirmed && payment === 'partial' && <Badge tone="stock-low">Señada · debe {formatCurrency(balance)}</Badge>}
          {isConfirmed && payment === 'unpaid' && <Badge tone="stock-low">Sin pagar</Badge>}
          {awaitingDelivery && (
            <Badge tone="brand">{order.delivery.method === 'shipping' ? 'Por enviar' : 'Por retirar'}</Badge>
          )}
        </div>
      </div>

      <ul className="mt-2.5 flex flex-col gap-1 border-t border-stone-100 pt-2.5 text-sm">
        {lines.map((line) => (
          <li key={`${line.productId}-${line.variantId}-${line.productName}`} className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 text-stone-700">
              <span className="font-semibold">{line.qty}x</span> {line.productName}
              {(line.size || line.color) && (
                <span className="text-stone-600"> ({[line.size, line.color].filter(Boolean).join('/')})</span>
              )}
              {line.unitPrice !== line.listPrice && line.productId && (
                <span className="text-xs text-stone-600"> · precio especial</span>
              )}
            </span>
            <span className="shrink-0 font-medium text-stone-900">{formatCurrency(line.subtotal)}</span>
          </li>
        ))}
      </ul>
      {order.lines.length > VISIBLE_LINES && (
        <button
          type="button"
          onClick={() => setShowAllLines((v) => !v)}
          className="inline-flex min-h-11 items-center text-xs font-semibold text-brand-700"
        >
          {showAllLines ? 'Ver menos' : `Ver ${order.lines.length - VISIBLE_LINES} prendas más`}
        </button>
      )}

      {(order.delivery.note || order.notes || order.customer.comment) && (
        <div className="mt-2 flex flex-col gap-0.5 text-xs text-stone-600">
          {order.delivery.note && <p>Entrega: {order.delivery.note}</p>}
          {order.customer.comment && <p>Comentario de la clienta: {order.customer.comment}</p>}
          {order.notes && <p>Nota: {order.notes}</p>}
        </div>
      )}

      {order.payments.length > 0 && (
        <ul className="mt-2 flex flex-col gap-0.5 text-xs text-stone-600" aria-label="Cobros">
          {order.payments.map((p) => (
            <li key={p.id} className="flex items-center gap-1">
              <span>
                Cobro {formatShortDate(p.date)} · {p.methodLabel} · {formatCurrency(p.amount)}
                {p.note && ` · ${p.note}`}
              </span>
              {isAdmin && onDeletePayment && !isCancelled && (
                <button
                  type="button"
                  onClick={() => onDeletePayment(order, p.id)}
                  aria-label={`Borrar el cobro de ${formatCurrency(p.amount)}`}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-base text-stone-500 hover:bg-stone-100 hover:text-red-700"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-stone-100 pt-2.5">
        <p className="font-heading text-base font-semibold text-brand-700">
          {formatCurrency(order.total)}
          <span className="ml-1.5 text-xs font-normal text-stone-600">
            ({order.itemCount} u.{order.discount > 0 ? ` · desc. ${formatCurrency(order.discount)}` : ''}
            {order.shippingCost > 0 ? ` · envío ${formatCurrency(order.shippingCost)}` : ''})
          </span>
        </p>
        {profit !== null && <p className="text-xs text-stone-600">Ganancia estimada {formatCurrency(profit)}</p>}
        {isConfirmed && balance > 0 && order.channel !== 'presencial' && (
          <p className="w-full text-xs text-stone-600">Reservada {relativeDay(order.saleDate)}</p>
        )}
      </div>

      {!isCancelled && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {balance > 0 && (
            <Button disabled={isBusy} onClick={() => onAction(order, 'pay')}>
              Cobrar
            </Button>
          )}
          {isPending && (
            <Button variant="secondary" disabled={isBusy} onClick={() => onAction(order, 'confirm')}>
              Confirmar
            </Button>
          )}
          {awaitingDelivery && (
            <Button variant="secondary" disabled={isBusy} onClick={() => onAction(order, 'deliver')}>
              {order.delivery.method === 'shipping' ? 'Marcar enviada' : 'Marcar entregada'}
            </Button>
          )}
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 font-heading text-sm font-semibold text-whatsapp-dark hover:bg-stone-50"
            >
              <WhatsAppIcon className="h-4 w-4" />
              Resumen
            </a>
          )}
          <Button variant="ghost" disabled={isBusy} onClick={() => onAction(order, 'edit')}>
            Editar
          </Button>
          <Button variant="danger" disabled={isBusy} onClick={() => onAction(order, 'cancel')}>
            {isPending ? 'Descartar' : 'Cancelar venta'}
          </Button>
        </div>
      )}
    </article>
  );
}
