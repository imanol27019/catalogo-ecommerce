import type { Order, NewOrderPayload, OrderStatus } from '../types/order';
import { apiGet, apiPatch, apiPost } from './apiClient';

/** Registra el pedido hecho desde el sitio. Queda pendiente hasta que el negocio lo confirme. */
export async function createOrder(payload: NewOrderPayload): Promise<Order> {
  return apiPost<Order>('/api/orders', payload);
}

/** Venta cargada a mano en el panel (mostrador): entra confirmada y descuenta stock al instante. */
export async function createManualSale(payload: NewOrderPayload, adminPassword: string): Promise<Order> {
  return apiPost<Order>('/api/sales', payload, adminPassword);
}

export async function fetchOrders(adminPassword: string): Promise<Order[]> {
  return apiGet<Order[]>('/api/orders', adminPassword);
}

export async function updateOrderStatus(
  id: string,
  status: Extract<OrderStatus, 'confirmed' | 'cancelled'>,
  adminPassword: string,
): Promise<Order> {
  return apiPatch<Order>(`/api/orders/${id}`, { status }, adminPassword);
}
