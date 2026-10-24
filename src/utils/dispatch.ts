import type { Carrier, DispatchPayload, Order, ShippingPayment } from '../types/order';
import { todayAr } from './sales';

export interface DispatchDraft {
  carrier: Carrier | null;
  carrierOther: string;
  trackingCode: string;
  shippingPayment: ShippingPayment | null;
  deliveredAt: string;
}

export function dispatchDraftFrom(delivery: Order['delivery']): DispatchDraft {
  return {
    carrier: delivery.carrier ?? (delivery.method === 'pickup' ? 'local' : null),
    carrierOther: delivery.carrierOther ?? '',
    trackingCode: delivery.trackingCode ?? '',
    shippingPayment: delivery.shippingPayment ?? null,
    deliveredAt: delivery.deliveredAt ?? todayAr(),
  };
}

/** Lo que falta completar para poder guardar el despacho, o `null` si está todo. */
export function validateDispatch(draft: DispatchDraft): string | null {
  if (!draft.carrier) return 'Elegí cómo se despachó.';
  if (draft.carrier === 'otro' && !draft.carrierOther.trim()) return 'Contá brevemente de qué se trató el despacho.';
  if (draft.carrier !== 'local' && !draft.shippingPayment) {
    return 'Marcá si la clienta pagó el envío antes o lo paga cuando lo recibe.';
  }
  return null;
}

export function dispatchPayloadFrom(draft: DispatchDraft): DispatchPayload {
  const isCarrier = draft.carrier !== 'local';
  return {
    status: 'delivered',
    carrier: draft.carrier ?? undefined,
    deliveredAt: draft.deliveredAt,
    ...(draft.carrier === 'otro' ? { carrierOther: draft.carrierOther.trim() } : {}),
    ...(isCarrier && draft.trackingCode.trim() ? { trackingCode: draft.trackingCode.trim() } : {}),
    ...(isCarrier && draft.shippingPayment ? { shippingPayment: draft.shippingPayment } : {}),
  };
}
