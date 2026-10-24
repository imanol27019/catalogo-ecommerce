import { addDays, daysInRange, eachDay, eachMonth, weekdayOf } from './dates';
import type { CatalogProduct, Order, SaleChannel } from './orders';

/**
 * Reporte de un período. Se calcula en el servidor y viaja ya resumido: así el panel no tiene que
 * bajar miles de ventas al celular para mostrar un año entero.
 *
 * Dos definiciones que conviene tener claras:
 * - "Vendido" es la mercadería: subtotal menos descuentos, SIN el envío cobrado (eso se le paga al
 *   transporte, no es venta). Se cuenta por la fecha de la venta.
 * - "Cobrado" es la plata que entró en el período, por la fecha de cada cobro. Una venta señada en
 *   septiembre y saldada en octubre suma a septiembre en "vendido" y reparte lo cobrado en los dos.
 */

export interface PeriodTotals {
  revenue: number;
  salesCount: number;
  units: number;
}

export interface SeriesPoint extends PeriodTotals {
  key: string;
}

export interface SalesReport {
  from: string;
  to: string;
  granularity: 'day' | 'month';
  totals: PeriodTotals & {
    avgTicket: number;
    discount: number;
    collected: number;
    /** Lo que falta cobrar de las ventas del período. */
    pendingBalance: number;
    /** Ganancia estimada sobre los renglones que tienen costo cargado. */
    profit: number;
    /** Parte de lo vendido que tiene costo cargado (0 a 1), para saber cuánto creerle a la ganancia. */
    costCoverage: number;
    newClients: number;
  };
  previous: PeriodTotals & { from: string; to: string };
  series: SeriesPoint[];
  byChannel: (PeriodTotals & { channel: SaleChannel })[];
  byPaymentMethod: { methodId: string; label: string; amount: number; count: number }[];
  bySeller: (PeriodTotals & { seller: string })[];
  byWeekday: (PeriodTotals & { weekday: number })[];
  byCategory: { category: string; units: number; revenue: number }[];
  topProducts: { key: string; name: string; units: number; revenue: number; profit: number | null }[];
  topClients: { key: string; clientId: string | null; name: string; revenue: number; salesCount: number; units: number; lastDate: string }[];
}

function emptyTotals(): PeriodTotals {
  return { revenue: 0, salesCount: 0, units: 0 };
}

function netRevenue(order: Order): number {
  return Math.max(0, order.subtotal - order.discount);
}

function clientKey(order: Order): string {
  return order.clientId ?? `nombre:${order.customer.name.trim().toLowerCase()}`;
}

function bump<K>(map: Map<K, PeriodTotals>, key: K, order: Order): void {
  const entry = map.get(key) ?? emptyTotals();
  entry.revenue += netRevenue(order);
  entry.salesCount += 1;
  entry.units += order.itemCount;
  map.set(key, entry);
}

function sortByRevenue<T extends { revenue: number }>(list: T[]): T[] {
  return list.sort((a, b) => b.revenue - a.revenue);
}

export interface ReportInput {
  from: string;
  to: string;
  /** Ventas confirmadas cuya fecha cae en el período. */
  sales: Order[];
  /** Ventas confirmadas con al menos un cobro dentro del período (pueden ser de antes). */
  salesWithPayments: Order[];
  /** Ventas confirmadas del período anterior de igual largo, para comparar. */
  previousSales: Order[];
  /** Primera compra de cada clienta (clave de `clientKey`), para contar clientas nuevas. */
  firstPurchaseByClient: Map<string, string>;
  products: CatalogProduct[];
  costs: Record<string, number>;
  categoryLabels: Record<string, string>;
}

export function buildSalesReport(input: ReportInput): SalesReport {
  const { from, to, sales } = input;
  const granularity = daysInRange(from, to) > 62 ? 'month' : 'day';
  const productById = new Map(input.products.map((p) => [p.id, p]));

  const totals = {
    ...emptyTotals(),
    avgTicket: 0,
    discount: 0,
    collected: 0,
    pendingBalance: 0,
    profit: 0,
    costCoverage: 0,
    newClients: 0,
  };

  const seriesMap = new Map<string, PeriodTotals>(
    (granularity === 'day' ? eachDay(from, to) : eachMonth(from, to)).map((k) => [k, emptyTotals()]),
  );
  const byChannel = new Map<SaleChannel, PeriodTotals>();
  const bySeller = new Map<string, PeriodTotals>();
  const byWeekday = new Map<number, PeriodTotals>();
  const byCategory = new Map<string, { units: number; revenue: number }>();
  const byProduct = new Map<string, { name: string; units: number; revenue: number; profit: number; costedUnits: number }>();
  const byClient = new Map<string, { clientId: string | null; name: string; revenue: number; salesCount: number; units: number; lastDate: string }>();
  const clientsInPeriod = new Set<string>();

  let costedRevenue = 0;
  let grossRevenue = 0;

  // Una bolsa recién abierta, sin prendas todavía, no es una venta (su seña sí cuenta como cobro).
  for (const order of sales.filter((o) => o.itemCount > 0)) {
    const revenue = netRevenue(order);
    totals.revenue += revenue;
    totals.salesCount += 1;
    totals.units += order.itemCount;
    totals.discount += order.discount;
    totals.pendingBalance += Math.max(0, order.total - order.paidAmount);

    const seriesKey = granularity === 'day' ? order.saleDate : order.saleDate.slice(0, 7);
    bump(seriesMap, seriesKey, order);
    bump(byChannel, order.channel, order);
    bump(bySeller, order.seller || 'Sin asignar', order);
    bump(byWeekday, weekdayOf(order.saleDate), order);

    // El descuento se reparte entre los renglones en proporción a su importe, para que la
    // ganancia por producto no quede inflada cuando se hizo una rebaja sobre el total.
    const discountRatio = order.subtotal > 0 ? revenue / order.subtotal : 1;

    for (const line of order.lines) {
      const lineRevenue = line.subtotal * discountRatio;
      grossRevenue += lineRevenue;
      const product = line.productId ? productById.get(line.productId) : undefined;

      const categoryId = product?.category ?? (line.productId ? 'sin-categoria' : 'fuera-del-catalogo');
      const category =
        input.categoryLabels[categoryId] ??
        (categoryId === 'fuera-del-catalogo' ? 'Fuera del catálogo' : categoryId === 'sin-categoria' ? 'Sin categoría' : categoryId);
      const cat = byCategory.get(category) ?? { units: 0, revenue: 0 };
      cat.units += line.qty;
      cat.revenue += lineRevenue;
      byCategory.set(category, cat);

      const unitCost = line.unitCost ?? (line.productId ? input.costs[line.productId] : undefined);
      const lineProfit = typeof unitCost === 'number' ? lineRevenue - unitCost * line.qty : null;
      if (lineProfit !== null) {
        totals.profit += lineProfit;
        costedRevenue += lineRevenue;
      }

      const productKey = line.productId || `libre:${line.productName.trim().toLowerCase()}`;
      const prod = byProduct.get(productKey) ?? { name: product?.name ?? line.productName, units: 0, revenue: 0, profit: 0, costedUnits: 0 };
      prod.units += line.qty;
      prod.revenue += lineRevenue;
      if (lineProfit !== null) {
        prod.profit += lineProfit;
        prod.costedUnits += line.qty;
      }
      byProduct.set(productKey, prod);
    }

    const key = clientKey(order);
    const isAnonymous = !order.clientId && /^(venta en el local|sin nombre)$/i.test(order.customer.name.trim());
    if (!isAnonymous) {
      clientsInPeriod.add(key);
      const client = byClient.get(key) ?? {
        clientId: order.clientId ?? null,
        name: order.customer.name,
        revenue: 0,
        salesCount: 0,
        units: 0,
        lastDate: order.saleDate,
      };
      client.revenue += revenue;
      client.salesCount += 1;
      client.units += order.itemCount;
      if (order.saleDate > client.lastDate) client.lastDate = order.saleDate;
      byClient.set(key, client);
    }
  }

  totals.avgTicket = totals.salesCount > 0 ? Math.round(totals.revenue / totals.salesCount) : 0;
  totals.costCoverage = grossRevenue > 0 ? costedRevenue / grossRevenue : 0;
  totals.profit = Math.round(totals.profit);
  totals.newClients = [...clientsInPeriod].filter((key) => {
    const first = input.firstPurchaseByClient.get(key);
    return first !== undefined && first >= from && first <= to;
  }).length;

  const byPaymentMethod = new Map<string, { methodId: string; label: string; amount: number; count: number }>();
  for (const order of input.salesWithPayments) {
    for (const payment of order.payments) {
      if (payment.date < from || payment.date > to) continue;
      totals.collected += payment.amount;
      const entry = byPaymentMethod.get(payment.methodId) ?? {
        methodId: payment.methodId,
        label: payment.methodLabel,
        amount: 0,
        count: 0,
      };
      entry.amount += payment.amount;
      entry.count += 1;
      byPaymentMethod.set(payment.methodId, entry);
    }
  }

  const previous = { ...emptyTotals(), from: addDays(from, -daysInRange(from, to)), to: addDays(from, -1) };
  for (const order of input.previousSales) {
    previous.revenue += netRevenue(order);
    previous.salesCount += 1;
    previous.units += order.itemCount;
  }

  return {
    from,
    to,
    granularity,
    totals,
    previous,
    series: [...seriesMap.entries()].map(([key, value]) => ({ key, ...value })),
    byChannel: sortByRevenue([...byChannel.entries()].map(([channel, value]) => ({ channel, ...value }))),
    byPaymentMethod: [...byPaymentMethod.values()].sort((a, b) => b.amount - a.amount),
    bySeller: sortByRevenue([...bySeller.entries()].map(([seller, value]) => ({ seller, ...value }))),
    byWeekday: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, ...(byWeekday.get(weekday) ?? emptyTotals()) })),
    byCategory: sortByRevenue([...byCategory.entries()].map(([category, v]) => ({ category, units: v.units, revenue: Math.round(v.revenue) }))),
    topProducts: [...byProduct.entries()]
      .map(([key, v]) => ({
        key,
        name: v.name,
        units: v.units,
        revenue: Math.round(v.revenue),
        // Solo se informa la ganancia si TODAS las unidades tienen costo; una parcial confunde.
        profit: v.costedUnits === v.units ? Math.round(v.profit) : null,
      }))
      .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
      .slice(0, 15),
    topClients: sortByRevenue([...byClient.entries()].map(([key, v]) => ({ key, ...v }))).slice(0, 15),
  };
}

export { clientKey };
