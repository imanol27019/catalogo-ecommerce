import type { NewOrderPayload, NewPaymentPayload, Order, SalePayload } from '../types/order';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './apiClient';

/** Registra el pedido hecho desde el sitio. Queda pendiente hasta que el negocio lo confirme. */
export async function createOrder(payload: NewOrderPayload): Promise<Order> {
  return apiPost<Order>('/api/orders', payload);
}

/** Venta cargada en el panel (local, live, WhatsApp): entra confirmada y descuenta stock al instante. */
export async function createSale(payload: SalePayload, password: string): Promise<Order> {
  return apiPost<Order>('/api/sales', payload, password);
}

/** Si la venta ya estaba confirmada, el servidor mueve el stock solo por la diferencia. */
export async function updateSale(id: string, payload: SalePayload, password: string): Promise<Order> {
  return apiPut<Order>(`/api/sales/${id}`, payload, password);
}

export type OrdersQuery = { pending: true } | { clientId: string } | { from: string; to: string };

export async function fetchOrders(query: OrdersQuery, password: string): Promise<Order[]> {
  const params = new URLSearchParams(
    'pending' in query ? { pending: '1' } : 'clientId' in query ? { clientId: query.clientId } : query,
  );
  return apiGet<Order[]>(`/api/orders?${params.toString()}`, password);
}

/** Confirmar descuenta stock; cancelar una venta confirmada lo devuelve. */
export async function updateOrderStatus(
  id: string,
  status: 'confirmed' | 'cancelled',
  password: string,
): Promise<Order> {
  return apiPatch<Order>(`/api/orders/${id}`, { status }, password);
}

export async function addPayment(id: string, payment: NewPaymentPayload, password: string): Promise<Order> {
  return apiPost<Order>(`/api/sales/${id}/payments`, payment, password);
}

export async function deletePayment(id: string, paymentId: string, password: string): Promise<Order> {
  return apiDelete<Order>(`/api/sales/${id}/payments/${paymentId}`, password);
}

export async function setDeliveryStatus(
  id: string,
  delivery: { status: 'pending' | 'delivered'; note?: string },
  password: string,
): Promise<Order> {
  return apiPatch<Order>(`/api/sales/${id}/delivery`, delivery, password);
}
