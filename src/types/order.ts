export interface OrderFormData {
  contactName: string;
  locality: string;
  shippingMethodId: string;
  comment?: string;
}

/**
 * - `pending`: pedido web que todavía no se confirmó. No toca el stock.
 * - `confirmed`: venta hecha. El stock ya se descontó; puede estar cobrada o no, entregada o no.
 * - `cancelled`: anulada. Si estaba confirmada, el stock volvió.
 */
export type OrderStatus = 'pending' | 'confirmed' | 'cancelled';

/** Por dónde entró la venta. `web` es el pedido armado en el catálogo, que llega por WhatsApp. */
export type SaleChannel = 'presencial' | 'tiktok' | 'whatsapp' | 'web';

export type DeliveryMethod = 'pickup' | 'shipping';
export type DeliveryStatus = 'pending' | 'delivered';

export interface OrderLine {
  /** Vacío en un artículo fuera del catálogo: no tiene stock que mover. */
  productId: string;
  productName: string;
  variantId: string;
  size: string;
  color: string;
  qty: number;
  unitPrice: number;
  /** Lo que correspondía según el catálogo. Si difiere de `unitPrice`, se cobró un precio especial. */
  listPrice: number;
  subtotal: number;
  /** Costo por unidad al momento de la venta. Solo llega si entró la administradora. */
  unitCost?: number;
}

export interface OrderCustomer {
  name: string;
  locality: string;
  shippingMethodLabel: string;
  comment?: string;
}

export interface SalePayment {
  id: string;
  /** Fecha del cobro (AAAA-MM-DD). Una seña y el saldo pueden caer en días distintos. */
  date: string;
  amount: number;
  methodId: string;
  methodLabel: string;
  note?: string;
  createdAt: string;
}

export interface OrderDelivery {
  method: DeliveryMethod;
  status: DeliveryStatus;
  deliveredAt?: string;
  /** Transporte, número de seguimiento, quién retira… */
  note?: string;
}

export interface Order {
  id: string;
  /** Código corto y legible para nombrar la venta al hablar con la clienta. */
  code: string;
  createdAt: string;
  updatedAt?: string;
  /** Día de la venta (AAAA-MM-DD, Argentina). Es la fecha que usan los reportes. */
  saleDate: string;
  status: OrderStatus;
  channel: SaleChannel;
  customer: OrderCustomer;
  clientId?: string;
  seller?: string;
  lines: OrderLine[];
  itemCount: number;
  subtotal: number;
  discount: number;
  shippingCost: number;
  /** Lo que paga la clienta: subtotal − descuento + envío. */
  total: number;
  payments: SalePayment[];
  paidAmount: number;
  delivery: OrderDelivery;
  notes?: string;
  resolvedAt?: string;
  cancelledAt?: string;
}

/** Lo que manda el catálogo web al crear un pedido: solo qué y cuánto, los precios los pone el servidor. */
export interface NewOrderPayload {
  customer: OrderCustomer;
  lines: { productId: string; variantId: string; qty: number }[];
}

/** Renglón de una venta cargada en el panel. Sin `productId` es un artículo fuera del catálogo. */
export interface SaleLinePayload {
  productId: string;
  variantId: string;
  qty: number;
  /** Solo si se cobró un precio distinto al de lista. */
  unitPrice?: number;
  /** Nombre del artículo fuera del catálogo. */
  name?: string;
  unitCost?: number;
}

export interface NewPaymentPayload {
  amount: number;
  methodId: string;
  date?: string;
  note?: string;
}

export interface SalePayload {
  channel: SaleChannel;
  saleDate: string;
  clientId: string | null;
  customer: { name: string; locality?: string; comment?: string };
  seller?: string;
  lines: SaleLinePayload[];
  discount: number;
  shippingCost: number;
  /** Solo al crear: los cobros de una venta existente se manejan aparte. */
  payments?: NewPaymentPayload[];
  delivery: { method: DeliveryMethod; status: DeliveryStatus; note?: string };
  notes?: string;
}
