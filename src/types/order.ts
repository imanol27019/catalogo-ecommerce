export interface OrderFormData {
  contactName: string;
  locality: string;
  shippingMethodId: string;
  comment?: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'cancelled';

/** De dónde salió la venta: un pedido del sitio o una carga manual del local. */
export type OrderSource = 'whatsapp' | 'manual';

export interface OrderLine {
  productId: string;
  productName: string;
  variantId: string;
  size: string;
  color: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderCustomer {
  name: string;
  locality: string;
  shippingMethodLabel: string;
  comment?: string;
}

export interface Order {
  id: string;
  /** Código corto y legible para nombrar la venta al hablar con la clienta. */
  code: string;
  createdAt: string;
  status: OrderStatus;
  source: OrderSource;
  customer: OrderCustomer;
  lines: OrderLine[];
  itemCount: number;
  total: number;
  /** Cuándo se confirmó o canceló (y por lo tanto cuándo se tocó el stock). */
  resolvedAt?: string;
}

/** Lo que manda el navegador al crear un pedido: solo qué y cuánto, los precios los pone el servidor. */
export interface NewOrderPayload {
  customer: OrderCustomer;
  lines: { productId: string; variantId: string; qty: number }[];
}
