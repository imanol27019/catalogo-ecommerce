import type express from 'express';
import type { Collection, Filter, Document } from 'mongodb';
import { requireAdmin, requireStaff, roleOf, sellerNameOf, setSellerLogins } from './auth';
import type { StaffRole } from './auth';
import { asyncRoute, HttpError } from './http';
import { isIsoDate, daysInRange, addDays, toArDate } from './dates';
import { buildClient, type Client } from './clients';
import {
  applyStockChanges,
  buildDelivery,
  buildPayment,
  changeSaleItems,
  isBagOpen,
  buildSale,
  buildWebOrder,
  generateOrderCode,
  normalizeLegacyOrder,
  stockChangesBetween,
  withTotals,
  type CatalogProduct,
  type Order,
} from './orders';
import { buildSalesReport, clientKey } from './reports';
import { sanitizeSalesConfig, withDefaults, type SalesConfig } from './salesConfig';

interface SalesRoutesDeps {
  ordersCollection: Collection;
  clientsCollection: Collection;
  salesConfigCollection: Collection;
  catalogCollection: Collection;
  getCatalogProducts: () => Promise<CatalogProduct[]>;
  getCategoryLabels: () => Promise<Record<string, string>>;
}

/** Tope para listados por rango: un año de un mayorista chico entra holgado. */
const MAX_LIST = 3000;
const MAX_REPORT_DAYS = 731;

function stripId<T>(doc: Document): T {
  const { _id, ...rest } = doc;
  return rest as T;
}

/** Las vendedoras no ven costos: se quitan antes de responder. */
function forRole(order: Order, role: StaffRole): Order {
  if (role === 'admin') return order;
  return { ...order, lines: order.lines.map(({ unitCost: _unitCost, ...line }) => line) };
}

export async function registerSalesRoutes(app: express.Express, deps: SalesRoutesDeps): Promise<void> {
  const { ordersCollection, clientsCollection, salesConfigCollection, catalogCollection } = deps;

  await Promise.all([
    ordersCollection.createIndex({ saleDate: -1, createdAt: -1 }),
    ordersCollection.createIndex({ clientId: 1 }),
    ordersCollection.createIndex({ status: 1 }),
    ordersCollection.createIndex({ code: 1 }),
    clientsCollection.createIndex({ name: 1 }),
  ]);

  // Las ventas anteriores a este sistema se completan una sola vez (canal, cobros, entrega).
  const legacy = await ordersCollection.find({ channel: { $exists: false } }).toArray();
  for (const doc of legacy) {
    const order = normalizeLegacyOrder(stripId(doc));
    await ordersCollection.replaceOne({ _id: doc._id }, { _id: order.id as never, ...order });
  }
  if (legacy.length > 0) console.log(`Ventas anteriores actualizadas al formato nuevo: ${legacy.length}.`);

  async function getSalesConfig(): Promise<SalesConfig> {
    const doc = await salesConfigCollection.findOne({ _id: 'salesConfig' as never });
    return withDefaults(doc ? stripId<Partial<SalesConfig>>(doc) : null);
  }

  // Las vendedoras pasaron de ser una lista de nombres (con una clave compartida) a cuentas
  // propias: se convierte una sola vez y se guarda, así cada una conserva el mismo id.
  const storedConfig = await salesConfigCollection.findOne({ _id: 'salesConfig' as never });
  if (storedConfig && !Array.isArray(storedConfig.sellerAccounts)) {
    const migrated = withDefaults(stripId(storedConfig));
    await salesConfigCollection.replaceOne({ _id: 'salesConfig' as never }, { _id: 'salesConfig' as never, ...migrated });
    console.log('Vendedoras convertidas a cuentas propias.');
  }

  setSellerLogins((await getSalesConfig()).sellerAccounts);

  async function loadOrder(id: string): Promise<Order> {
    const doc = await ordersCollection.findOne({ _id: id as never });
    if (!doc) throw new HttpError(404, 'No encontramos esa venta. Puede que se haya borrado.');
    return stripId<Order>(doc);
  }

  async function saveOrder(order: Order): Promise<void> {
    await ordersCollection.replaceOne({ _id: order.id as never }, { _id: order.id as never, ...order });
  }

  async function loadClient(clientId: unknown): Promise<Client | null> {
    if (clientId === undefined || clientId === null || clientId === '') return null;
    const doc = await clientsCollection.findOne({ _id: String(clientId) as never });
    if (!doc) throw new HttpError(400, 'La clienta elegida ya no existe. Elegila de nuevo.');
    return stripId<Client>(doc);
  }

  // --- Configuración de ventas -----------------------------------------------

  /** Las vendedoras ven los nombres (para las ventas) pero no los usuarios ni los costos. */
  function publicConfig(config: SalesConfig, role: StaffRole) {
    return {
      sellers: config.sellerAccounts.map((s) => s.name),
      paymentMethods: config.paymentMethods,
      bagDays: config.bagDays,
      messageTemplates: config.messageTemplates,
      ...(role === 'admin'
        ? {
            costs: config.costs,
            sellerAccounts: config.sellerAccounts.map((s) => ({
              id: s.id,
              name: s.name,
              username: s.username,
              hasAccess: Boolean(s.passwordHash),
            })),
          }
        : {}),
    };
  }

  app.get(
    '/api/sales-config',
    requireStaff,
    asyncRoute(async (_req, res) => {
      res.json(publicConfig(await getSalesConfig(), roleOf(res)));
    }),
  );

  app.put(
    '/api/sales-config',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const current = await getSalesConfig();
      const updated: SalesConfig = { ...sanitizeSalesConfig(req.body, current), updatedAt: new Date().toISOString() };
      await salesConfigCollection.replaceOne(
        { _id: 'salesConfig' as never },
        { _id: 'salesConfig' as never, ...updated },
        { upsert: true },
      );
      // Una vendedora a la que se le quitó el acceso o se le cambió la contraseña queda afuera en
      // su próximo pedido.
      setSellerLogins(updated.sellerAccounts);
      res.json(publicConfig(updated, 'admin'));
    }),
  );

  // --- Clientas --------------------------------------------------------------

  /** Datos de compra de cada clienta, calculados en la base para no traer todas las ventas. */
  async function clientStats(): Promise<Map<string, Document>> {
    const rows = await ordersCollection
      .aggregate([
        // Una bolsa recién abierta, todavía sin prendas, no cuenta como compra.
        { $match: { status: 'confirmed', clientId: { $type: 'string' }, itemCount: { $gt: 0 } } },
        {
          $group: {
            _id: '$clientId',
            salesCount: { $sum: 1 },
            revenue: { $sum: { $subtract: ['$subtotal', '$discount'] } },
            units: { $sum: '$itemCount' },
            firstDate: { $min: '$saleDate' },
            lastDate: { $max: '$saleDate' },
            balance: { $sum: { $max: [0, { $subtract: ['$total', '$paidAmount'] }] } },
            pendingDeliveries: { $sum: { $cond: [{ $eq: ['$delivery.status', 'pending'] }, 1, 0] } },
          },
        },
      ])
      .toArray();
    return new Map(rows.map((r) => [String(r._id), r]));
  }

  app.get(
    '/api/clients',
    requireStaff,
    asyncRoute(async (_req, res) => {
      const [docs, stats] = await Promise.all([clientsCollection.find({}).toArray(), clientStats()]);
      res.json(
        docs.map((doc) => {
          const client = stripId<Client>(doc);
          const s = stats.get(client.id);
          return {
            ...client,
            stats: {
              salesCount: s?.salesCount ?? 0,
              revenue: s?.revenue ?? 0,
              units: s?.units ?? 0,
              firstDate: s?.firstDate ?? null,
              lastDate: s?.lastDate ?? null,
              balance: s?.balance ?? 0,
              pendingDeliveries: s?.pendingDeliveries ?? 0,
            },
          };
        }),
      );
    }),
  );

  /** Dos fichas con el mismo TikTok o el mismo WhatsApp son casi seguro la misma persona. */
  async function assertNoDuplicate(client: Client): Promise<void> {
    const or: Filter<Document>[] = [];
    if (client.tiktok) or.push({ tiktok: client.tiktok });
    if (client.whatsapp) or.push({ whatsapp: client.whatsapp });
    if (or.length === 0) return;
    const other = await clientsCollection.findOne({ $or: or, _id: { $ne: client.id as never } });
    if (other) {
      const same = other.tiktok && other.tiktok === client.tiktok ? `el TikTok @${client.tiktok}` : 'ese WhatsApp';
      throw new HttpError(409, `Ya hay una clienta con ${same}: ${String(other.name)}.`);
    }
  }

  app.post(
    '/api/clients',
    requireStaff,
    asyncRoute(async (req, res) => {
      const client = buildClient(req.body);
      await assertNoDuplicate(client);
      await clientsCollection.insertOne({ _id: client.id as never, ...client });
      res.status(201).json(client);
    }),
  );

  app.put(
    '/api/clients/:id',
    requireStaff,
    asyncRoute(async (req, res) => {
      const existing = await loadClient(req.params.id).catch(() => null);
      if (!existing) throw new HttpError(404, 'No encontramos esa clienta.');
      const client = buildClient(req.body, existing);
      await assertNoDuplicate(client);
      await clientsCollection.replaceOne({ _id: client.id as never }, { _id: client.id as never, ...client });

      // El nombre que se ve en cada venta es una copia: se actualiza para que el historial no
      // muestre el apodo viejo.
      if (client.name !== existing.name || client.locality !== existing.locality) {
        await ordersCollection.updateMany(
          { clientId: client.id },
          { $set: { 'customer.name': client.name, 'customer.locality': client.locality ?? '' } },
        );
      }
      res.json(client);
    }),
  );

  app.delete(
    '/api/clients/:id',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const sales = await ordersCollection.countDocuments({ clientId: req.params.id });
      if (sales > 0) {
        throw new HttpError(409, `No se puede borrar: tiene ${sales} venta${sales === 1 ? '' : 's'} registrada${sales === 1 ? '' : 's'}.`);
      }
      await clientsCollection.deleteOne({ _id: req.params.id as never });
      res.json({ ok: true });
    }),
  );

  // --- Ventas ------------------------------------------------------------------

  /** Público: lo llama el navegador al finalizar el pedido. Queda pendiente hasta que el negocio confirme. */
  app.post(
    '/api/orders',
    asyncRoute(async (req, res) => {
      const order = buildWebOrder(req.body, await deps.getCatalogProducts(), await generateOrderCode(ordersCollection));
      await ordersCollection.insertOne({ _id: order.id as never, ...order });
      res.status(201).json(order);
    }),
  );

  /**
   * Listado de ventas. Tres formas de pedirlo:
   * - `?pending=1`: lo que requiere acción (pedidos web sin confirmar, saldos, entregas pendientes).
   * - `?clientId=…`: el historial de una clienta.
   * - `?from=…&to=…`: un rango de fechas de venta (por defecto, hoy).
   */
  app.get(
    '/api/orders',
    requireStaff,
    asyncRoute(async (req, res) => {
      const query = req.query as Record<string, string | undefined>;
      let filter: Filter<Document>;

      if (query.pending === '1') {
        filter = {
          $or: [
            { status: 'pending' },
            { status: 'confirmed', $expr: { $lt: ['$paidAmount', '$total'] } },
            { status: 'confirmed', 'delivery.status': 'pending' },
          ],
        };
      } else if (query.clientId) {
        filter = { clientId: query.clientId };
      } else {
        const today = toArDate();
        const from = isIsoDate(query.from) ? query.from : today;
        const to = isIsoDate(query.to) ? query.to : from;
        filter = { saleDate: { $gte: from, $lte: to } };
      }

      const docs = await ordersCollection.find(filter).sort({ saleDate: -1, createdAt: -1 }).limit(MAX_LIST).toArray();
      const role = roleOf(res);
      res.json(docs.map((doc) => forRole(stripId<Order>(doc), role)));
    }),
  );

  app.post(
    '/api/sales',
    requireStaff,
    asyncRoute(async (req, res) => {
      // Si entró una vendedora, la venta queda a su nombre: no se puede cargar a nombre de otra.
      const sellerName = sellerNameOf(res);
      const body: Record<string, unknown> = { ...((req.body ?? {}) as Record<string, unknown>), ...(sellerName ? { seller: sellerName } : {}) };
      const [products, config, client] = await Promise.all([
        deps.getCatalogProducts(),
        getSalesConfig(),
        loadClient(body.clientId),
      ]);
      const order = buildSale(
        body,
        { products, costs: config.costs, paymentMethods: config.paymentMethods, client, bagDays: config.bagDays },
        { code: await generateOrderCode(ordersCollection) },
      );
      await ordersCollection.insertOne({ _id: order.id as never, ...order });
      await applyStockChanges(catalogCollection, stockChangesBetween([], order.lines));
      res.status(201).json(forRole(order, roleOf(res)));
    }),
  );

  /** Editar una venta: si ya estaba confirmada, el stock se mueve solo por la diferencia. */
  app.put(
    '/api/sales/:id',
    requireStaff,
    asyncRoute(async (req, res) => {
      const existing = await loadOrder(req.params.id);
      if (existing.status === 'cancelled') throw new HttpError(409, 'Esta venta está cancelada: no se puede editar.');

      // Una vendedora que corrige una venta no se la queda: sigue a nombre de quien la hizo.
      const sellerName = sellerNameOf(res);
      const body: Record<string, unknown> = {
        ...((req.body ?? {}) as Record<string, unknown>),
        ...(sellerName ? { seller: existing.seller ?? sellerName } : {}),
      };
      const [products, config, client] = await Promise.all([
        deps.getCatalogProducts(),
        getSalesConfig(),
        loadClient(body.clientId),
      ]);
      const order = buildSale(
        body,
        { products, costs: config.costs, paymentMethods: config.paymentMethods, client, bagDays: config.bagDays },
        existing,
      );
      await saveOrder(order);
      if (existing.status === 'confirmed') {
        await applyStockChanges(catalogCollection, stockChangesBetween(existing.lines, order.lines));
      }
      res.json(forRole(order, roleOf(res)));
    }),
  );

  /**
   * Confirmar descuenta stock una sola vez. Cancelar una venta confirmada lo devuelve: es lo que
   * pasa cuando una clienta del live no paga y la prenda vuelve a estar disponible.
   */
  app.patch(
    '/api/orders/:id',
    requireStaff,
    asyncRoute(async (req, res) => {
      const { status } = (req.body ?? {}) as { status?: string };
      if (status !== 'confirmed' && status !== 'cancelled') {
        throw new HttpError(400, 'El estado debe ser "confirmed" o "cancelled".');
      }
      const order = await loadOrder(req.params.id);
      const role = roleOf(res);
      const now = new Date().toISOString();

      if (status === 'confirmed') {
        if (order.status !== 'pending') throw new HttpError(409, 'Esta venta ya estaba confirmada o cancelada.');
        const updated: Order = { ...order, status: 'confirmed', resolvedAt: now, updatedAt: now };
        await saveOrder(updated);
        await applyStockChanges(catalogCollection, stockChangesBetween([], order.lines));
        res.json(forRole(updated, role));
        return;
      }

      if (order.status === 'cancelled') throw new HttpError(409, 'Esta venta ya estaba cancelada.');
      if (role !== 'admin' && order.paidAmount > 0) {
        throw new HttpError(403, 'Esta venta tiene cobros registrados: solo la administradora puede cancelarla.');
      }
      const updated: Order = { ...order, status: 'cancelled', cancelledAt: now, updatedAt: now };
      await saveOrder(updated);
      if (order.status === 'confirmed') {
        await applyStockChanges(catalogCollection, stockChangesBetween(order.lines, []));
      }
      res.json(forRole(updated, role));
    }),
  );

  /**
   * Eliminar una venta para siempre (una devolución, o una venta mal cargada). Si estaba
   * confirmada, sus prendas vuelven al stock; sus cobros dejan de figurar en la caja y en los
   * reportes. Solo la dueña: a diferencia de cancelar, no deja rastro.
   */
  app.delete(
    '/api/sales/:id',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const order = await loadOrder(req.params.id);
      await ordersCollection.deleteOne({ _id: order.id as never });
      if (order.status === 'confirmed') {
        await applyStockChanges(catalogCollection, stockChangesBetween(order.lines, []));
      }
      res.json({ ok: true, restoredUnits: order.status === 'confirmed' ? order.itemCount : 0 });
    }),
  );

  /** Registrar un cobro. Si era un pedido web sin confirmar, cobrar la seña lo confirma. */
  app.post(
    '/api/sales/:id/payments',
    requireStaff,
    asyncRoute(async (req, res) => {
      const order = await loadOrder(req.params.id);
      if (order.status === 'cancelled') throw new HttpError(409, 'Esta venta está cancelada.');

      const config = await getSalesConfig();
      const payment = buildPayment(req.body, config.paymentMethods, toArDate());
      // En una bolsa abierta se puede señar de más: lo que sobra queda a favor para las próximas prendas.
      const balance = order.total - order.paidAmount;
      if (!isBagOpen(order) && payment.amount > balance) {
        throw new HttpError(400, `El cobro supera lo que falta pagar (${balance.toLocaleString('es-AR')}).`);
      }

      const now = new Date().toISOString();
      const wasPending = order.status === 'pending';
      const updated = withTotals({
        ...order,
        payments: [...order.payments, payment],
        status: 'confirmed',
        updatedAt: now,
        ...(wasPending ? { resolvedAt: now } : {}),
      });
      await saveOrder(updated);
      if (wasPending) await applyStockChanges(catalogCollection, stockChangesBetween([], order.lines));
      res.json(forRole(updated, roleOf(res)));
    }),
  );

  /** Borrar un cobro mal cargado. Solo la dueña: es plata que deja de figurar como cobrada. */
  app.delete(
    '/api/sales/:id/payments/:paymentId',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const order = await loadOrder(req.params.id);
      if (!order.payments.some((p) => p.id === req.params.paymentId)) throw new HttpError(404, 'Ese cobro ya no existe.');
      const updated = withTotals({
        ...order,
        payments: order.payments.filter((p) => p.id !== req.params.paymentId),
        updatedAt: new Date().toISOString(),
      });
      await saveOrder(updated);
      res.json(updated);
    }),
  );

  app.patch(
    '/api/sales/:id/delivery',
    requireStaff,
    asyncRoute(async (req, res) => {
      const order = await loadOrder(req.params.id);
      if (order.status !== 'confirmed') throw new HttpError(409, 'Primero confirmá la venta.');
      if (isBagOpen(order)) throw new HttpError(409, 'La bolsa sigue abierta: cerrala antes de despacharla.');
      const body = (req.body ?? {}) as Record<string, unknown>;
      const status = body.status === 'delivered' ? 'delivered' : 'pending';
      if (status === 'delivered' && !body.carrier) throw new HttpError(400, 'Elegí cómo se despachó.');
      const updated: Order = {
        ...order,
        delivery: buildDelivery(
          { ...body, status, deliveredAt: isIsoDate(body.deliveredAt) ? body.deliveredAt : toArDate() },
          { method: order.delivery.method, status: 'pending', ...(order.delivery.note ? { note: order.delivery.note } : {}) },
          toArDate(),
        ),
        updatedAt: new Date().toISOString(),
      };
      await saveOrder(updated);
      res.json(forRole(updated, roleOf(res)));
    }),
  );

  /**
   * Modo live: suma (o resta) una prenda a la venta con un toque. El stock se mueve en el momento,
   * así la prenda que se guardó en la bolsa de una clienta ya no le aparece disponible a otra.
   */
  app.post(
    '/api/sales/:id/items',
    requireStaff,
    asyncRoute(async (req, res) => {
      const order = await loadOrder(req.params.id);
      if (order.status === 'cancelled') throw new HttpError(409, 'Esta venta está cancelada.');
      const [products, config] = await Promise.all([deps.getCatalogProducts(), getSalesConfig()]);
      const body = (req.body ?? {}) as Record<string, unknown>;
      // Varias prendas de una (`items`) o una sola (compatibilidad con el panel anterior).
      const rawItems = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [body];
      const updated = changeSaleItems(
        order,
        rawItems.map((item) => ({ productId: item.productId, variantId: item.variantId, qty: item.qty })),
        { products, costs: config.costs },
      );
      await saveOrder(updated);
      if (order.status === 'confirmed') {
        await applyStockChanges(catalogCollection, stockChangesBetween(order.lines, updated.lines));
      }
      res.json(forRole(updated, roleOf(res)));
    }),
  );

  /**
   * Cerrar la bolsa: deja de sumar prendas y pasa a ser una venta normal (por cobrar el saldo y por
   * despachar). Si se cerró por error, se puede reabrir mientras no se haya despachado.
   */
  app.patch(
    '/api/sales/:id/bag',
    requireStaff,
    asyncRoute(async (req, res) => {
      const order = await loadOrder(req.params.id);
      if (!order.bag) throw new HttpError(400, 'Esta venta no es una bolsa.');
      if (order.status === 'cancelled') throw new HttpError(409, 'Esta venta está cancelada.');
      const body = (req.body ?? {}) as Record<string, unknown>;
      const now = new Date().toISOString();
      let bag = order.bag;

      if (body.action === 'close') {
        if (order.lines.length === 0) {
          throw new HttpError(400, 'La bolsa está vacía. Si no se llevó nada, cancelala.');
        }
        if (order.paidAmount > order.total) {
          throw new HttpError(
            400,
            `Pagó ${(order.paidAmount - order.total).toLocaleString('es-AR')} más de lo que suma la bolsa. Sumá prendas o corregí el cobro antes de cerrarla.`,
          );
        }
        bag = { ...bag, closedAt: now };
      } else if (body.action === 'reopen') {
        if (order.delivery.status === 'delivered') throw new HttpError(409, 'Ya se despachó: no se puede reabrir.');
        const { closedAt: _closedAt, ...rest } = bag;
        bag = { ...rest, closesOn: isIsoDate(body.closesOn) ? body.closesOn : rest.closesOn };
      } else {
        throw new HttpError(400, 'Acción inválida.');
      }

      const updated: Order = { ...order, bag, updatedAt: now };
      await saveOrder(updated);
      res.json(forRole(updated, roleOf(res)));
    }),
  );

  /**
   * Cierre de caja: todo lo que entró en un día, por medio de pago. Incluye saldos de ventas de
   * días anteriores (una seña del live del martes que se terminó de pagar hoy), que es justo lo
   * que no se ve mirando solo las ventas del día. Lo pueden ver también las vendedoras: son ellas
   * las que cuentan la plata al cerrar.
   */
  app.get(
    '/api/cash',
    requireStaff,
    asyncRoute(async (req, res) => {
      const date = isIsoDate(req.query.date) ? req.query.date : toArDate();
      const docs = await ordersCollection
        .find({ status: 'confirmed', 'payments.date': date })
        .project({ id: 1, code: 1, 'customer.name': 1, payments: 1, saleDate: 1 })
        .toArray();

      const payments = docs.flatMap((doc) =>
        (doc.payments as Order['payments'])
          .filter((p) => p.date === date)
          .map((p) => ({
            orderId: String(doc.id),
            code: String(doc.code),
            customerName: String(doc.customer?.name ?? ''),
            saleDate: String(doc.saleDate),
            amount: p.amount,
            methodId: p.methodId,
            methodLabel: p.methodLabel,
            note: p.note,
            createdAt: p.createdAt,
          })),
      );
      payments.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      const byMethod = new Map<string, { methodId: string; label: string; amount: number; count: number }>();
      for (const p of payments) {
        const entry = byMethod.get(p.methodId) ?? { methodId: p.methodId, label: p.methodLabel, amount: 0, count: 0 };
        entry.amount += p.amount;
        entry.count += 1;
        byMethod.set(p.methodId, entry);
      }

      res.json({
        date,
        total: payments.reduce((sum, p) => sum + p.amount, 0),
        byMethod: [...byMethod.values()].sort((a, b) => b.amount - a.amount),
        payments,
      });
    }),
  );

  // --- Reportes ----------------------------------------------------------------

  app.get(
    '/api/reports',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const query = req.query as Record<string, string | undefined>;
      const today = toArDate();
      const from = isIsoDate(query.from) ? query.from : today;
      const to = isIsoDate(query.to) ? query.to : today;
      if (from > to) throw new HttpError(400, 'La fecha "desde" es posterior a la fecha "hasta".');
      if (daysInRange(from, to) > MAX_REPORT_DAYS) throw new HttpError(400, 'Elegí un período de hasta dos años.');

      const length = daysInRange(from, to);
      const prevFrom = addDays(from, -length);
      const prevTo = addDays(from, -1);

      const [sales, salesWithPayments, previousSales, firstRows, products, config, categoryLabels] = await Promise.all([
        ordersCollection.find({ status: 'confirmed', saleDate: { $gte: from, $lte: to } }).toArray(),
        ordersCollection
          .find({ status: 'confirmed', payments: { $elemMatch: { date: { $gte: from, $lte: to } } } })
          .project({ payments: 1 })
          .toArray(),
        ordersCollection
          .find({ status: 'confirmed', saleDate: { $gte: prevFrom, $lte: prevTo } })
          .project({ subtotal: 1, discount: 1, itemCount: 1 })
          .toArray(),
        ordersCollection
          .find({ status: 'confirmed', saleDate: { $lte: to } })
          .project({ clientId: 1, 'customer.name': 1, saleDate: 1 })
          .toArray(),
        deps.getCatalogProducts(),
        getSalesConfig(),
        deps.getCategoryLabels(),
      ]);

      const firstPurchaseByClient = new Map<string, string>();
      for (const row of firstRows) {
        const key = clientKey(row as unknown as Order);
        const date = String(row.saleDate);
        const known = firstPurchaseByClient.get(key);
        if (!known || date < known) firstPurchaseByClient.set(key, date);
      }

      res.json(
        buildSalesReport({
          from,
          to,
          sales: sales.map((d) => stripId<Order>(d)),
          salesWithPayments: salesWithPayments.map((d) => stripId<Order>(d)),
          previousSales: previousSales.map((d) => stripId<Order>(d)),
          firstPurchaseByClient,
          products,
          costs: config.costs,
          categoryLabels,
        }),
      );
    }),
  );
}
