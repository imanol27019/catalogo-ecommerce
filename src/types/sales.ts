import type { SaleChannel } from './order';

/** `admin` = la dueña, ve todo. `seller` = vendedora: ventas y clientas, sin costos ni reportes. */
export type StaffRole = 'admin' | 'seller';

export interface PaymentMethod {
  id: string;
  label: string;
}

export interface SalesConfig {
  sellers: string[];
  paymentMethods: PaymentMethod[];
  /** Si hay una clave de vendedoras definida (la clave en sí nunca vuelve del servidor). */
  hasSellerKey: boolean;
  /** Costo por unidad de cada producto. Solo llega si entró la administradora. */
  costs?: Record<string, number>;
}

export interface SalesConfigPayload {
  sellers: string[];
  paymentMethods: PaymentMethod[];
  costs: Record<string, number>;
  /** `undefined` = no cambiarla, `null` = quitarla, texto = clave nueva. */
  sellerKey?: string | null;
}

export interface Client {
  id: string;
  name: string;
  /** Usuario de TikTok sin la arroba. */
  tiktok?: string;
  /** Solo dígitos (549...). */
  whatsapp?: string;
  locality?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ClientStats {
  salesCount: number;
  revenue: number;
  units: number;
  firstDate: string | null;
  lastDate: string | null;
  /** Lo que debe sumando todas sus ventas. */
  balance: number;
  pendingDeliveries: number;
}

export interface ClientWithStats extends Client {
  stats: ClientStats;
}

export type ClientPayload = Pick<Client, 'name' | 'tiktok' | 'whatsapp' | 'locality' | 'notes'>;

export interface CashMethodTotal {
  methodId: string;
  label: string;
  amount: number;
  count: number;
}

/** Cierre de caja de un día: lo que entró, por medio de pago. */
export interface CashSummary {
  date: string;
  total: number;
  byMethod: CashMethodTotal[];
  payments: {
    orderId: string;
    code: string;
    customerName: string;
    saleDate: string;
    amount: number;
    methodId: string;
    methodLabel: string;
    note?: string;
    createdAt: string;
  }[];
}

export interface PeriodTotals {
  revenue: number;
  salesCount: number;
  units: number;
}

export interface SalesReport {
  from: string;
  to: string;
  granularity: 'day' | 'month';
  totals: PeriodTotals & {
    avgTicket: number;
    discount: number;
    collected: number;
    pendingBalance: number;
    profit: number;
    costCoverage: number;
    newClients: number;
  };
  previous: PeriodTotals & { from: string; to: string };
  series: (PeriodTotals & { key: string })[];
  byChannel: (PeriodTotals & { channel: SaleChannel })[];
  byPaymentMethod: { methodId: string; label: string; amount: number; count: number }[];
  bySeller: (PeriodTotals & { seller: string })[];
  byWeekday: (PeriodTotals & { weekday: number })[];
  byCategory: { category: string; units: number; revenue: number }[];
  topProducts: { key: string; name: string; units: number; revenue: number; profit: number | null }[];
  topClients: {
    key: string;
    clientId: string | null;
    name: string;
    revenue: number;
    salesCount: number;
    units: number;
    lastDate: string;
  }[];
}
