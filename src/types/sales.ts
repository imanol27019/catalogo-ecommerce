import type { SaleChannel } from './order';

/** `admin` = la dueña, ve todo. `seller` = vendedora: ventas y clientas, sin costos ni reportes. */
export type StaffRole = 'admin' | 'seller';

export interface PaymentMethod {
  id: string;
  label: string;
}

/** Textos de los mensajes de WhatsApp. Vacío = el texto de fábrica (ver `utils/messages.ts`). */
export interface MessageTemplates {
  summary: string;
  dispatch: string;
}

/** Cuenta de una vendedora tal como la ve la administradora (la contraseña nunca vuelve). */
export interface SellerAccountInfo {
  id: string;
  name: string;
  username: string;
  /** Tiene contraseña: puede entrar al panel. */
  hasAccess: boolean;
}

export interface SalesConfig {
  /** Nombres de las vendedoras, para atribuir las ventas. */
  sellers: string[];
  paymentMethods: PaymentMethod[];
  /** Cuántos días queda abierta la bolsa de una clienta de live. */
  bagDays: number;
  messageTemplates: Partial<MessageTemplates>;
  /** Costo por unidad de cada producto. Solo llega si entró la administradora. */
  costs?: Record<string, number>;
  /** Solo llega si entró la administradora. */
  sellerAccounts?: SellerAccountInfo[];
}

export interface SellerAccountPayload {
  /** Sin id = vendedora nueva. */
  id?: string;
  name: string;
  username: string;
  /** `undefined` = no tocarla, `null` = quitarle el acceso, texto = contraseña nueva. */
  password?: string | null;
}

export interface SalesConfigPayload {
  sellerAccounts: SellerAccountPayload[];
  paymentMethods: PaymentMethod[];
  bagDays: number;
  costs: Record<string, number>;
  messageTemplates: Partial<MessageTemplates>;
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
