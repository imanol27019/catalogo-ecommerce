import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Order, SaleChannel } from '../../types/order';
import type { Product } from '../../types/product';
import type { CashSummary, Client, ClientPayload, ClientWithStats, SalesConfig } from '../../types/sales';
import { deletePayment, fetchOrders, setDeliveryStatus, updateOrderStatus } from '../../data/orders';
import { fetchCashSummary } from '../../data/sales';
import { BUSINESS_NAME } from '../../config/site.config';
import { formatCurrency, plural } from '../../utils/format';
import {
  addDays,
  balanceOf,
  buildSaleSummaryMessage,
  buildWhatsAppChatUrl,
  CHANNEL_LABELS,
  downloadTextFile,
  endOfMonth,
  normalizeSearch,
  ordersToCsv,
  startOfMonth,
  startOfWeek,
  todayAr,
} from '../../utils/sales';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Alert } from '../ui/Alert';
import { INPUT_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from '../ui/formStyles';
import { AdminSaleForm, type DraftLine } from './AdminSaleForm';
import { PaymentDialog } from './PaymentDialog';
import { SaleCard, type SaleAction } from './SaleCard';
import { describeApiError, useAdminSession } from './adminSession';

interface AdminSalesManagerProps {
  products: Product[];
  clients: ClientWithStats[];
  config: SalesConfig;
  onCreateClient: (payload: ClientPayload) => Promise<Client>;
  /** Tras una venta cambian las compras y el saldo de las clientas. */
  onClientsChanged: () => void;
  /** Se llama tras cualquier cambio de stock para refrescar el catálogo del panel. */
  onStockChanged: () => void;
}

type View = 'today' | 'pending' | 'history';
type FormState = { mode: 'new' } | { mode: 'edit'; order: Order; appendLines?: DraftLine[] } | null;

export function AdminSalesManager({
  products,
  clients,
  config,
  onCreateClient,
  onClientsChanged,
  onStockChanged,
}: AdminSalesManagerProps) {
  const session = useAdminSession();
  const isAdmin = session.role === 'admin';
  const today = todayAr();

  const [view, setView] = useState<View>('today');
  const [form, setForm] = useState<FormState>(null);
  const [paying, setPaying] = useState<Order | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<Order | null>(null);

  const [todayOrders, setTodayOrders] = useState<Order[] | null>(null);
  const [cash, setCash] = useState<CashSummary | null>(null);
  const [pendingOrders, setPendingOrders] = useState<Order[] | null>(null);
  const [historyOrders, setHistoryOrders] = useState<Order[] | null>(null);
  const [range, setRange] = useState({ from: startOfMonth(today), to: today });

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  /**
   * Cada acción (cobrar, enviar, cancelar) puede cambiar más de una lista a la vez — una venta
   * cobrada deja de estar pendiente y suma a la caja del día —, así que en vez de actualizar a mano
   * se piden de nuevo. `reloadToken` es el disparador: subirlo vuelve a correr las cargas.
   */
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    Promise.all([
      fetchOrders({ from: today, to: today }, session.password),
      fetchCashSummary(today, session.password),
      fetchOrders({ pending: true }, session.password),
    ])
      .then(([todayList, cashSummary, pendingList]) => {
        if (!isCurrent) return;
        setTodayOrders(todayList);
        setCash(cashSummary);
        setPendingOrders(pendingList);
        setError(null);
      })
      .catch((err: unknown) => {
        const message = describeApiError(err, session, 'No se pudieron cargar las ventas.');
        if (isCurrent && message) setError(message);
      });
    return () => {
      isCurrent = false;
    };
  }, [today, session, reloadToken]);

  useEffect(() => {
    if (view !== 'history') return;
    let isCurrent = true;
    fetchOrders(range, session.password)
      .then((list) => {
        if (!isCurrent) return;
        setHistoryOrders(list);
        setError(null);
      })
      .catch((err: unknown) => {
        const message = describeApiError(err, session, 'No se pudo cargar el historial.');
        if (isCurrent && message) setError(message);
      });
    return () => {
      isCurrent = false;
    };
  }, [view, range, session, reloadToken]);

  function afterChange(stockChanged: boolean) {
    setReloadToken((t) => t + 1);
    onClientsChanged();
    if (stockChanged) onStockChanged();
  }

  async function runAction(order: Order, action: () => Promise<unknown>, stockChanged: boolean, fallback: string) {
    setBusyId(order.id);
    setError(null);
    try {
      await action();
      afterChange(stockChanged);
    } catch (err) {
      const message = describeApiError(err, session, fallback);
      if (message) setError(message);
    } finally {
      setBusyId(null);
    }
  }

  function handleAction(order: Order, action: SaleAction) {
    setSavedNotice(null);
    switch (action) {
      case 'pay':
        setPaying(order);
        return;
      case 'edit':
        setForm({ mode: 'edit', order });
        return;
      case 'deliver':
        void runAction(
          order,
          () => setDeliveryStatus(order.id, { status: 'delivered' }, session.password),
          false,
          'No se pudo marcar la entrega.',
        );
        return;
      case 'confirm':
        if (!window.confirm(`¿Confirmar el pedido ${order.code}? Se descuentan ${order.itemCount} prendas del stock.`)) return;
        void runAction(
          order,
          () => updateOrderStatus(order.id, 'confirmed', session.password),
          true,
          'No se pudo confirmar el pedido.',
        );
        return;
      case 'cancel': {
        const question =
          order.status === 'pending'
            ? `¿Descartar el pedido web ${order.code}?`
            : `¿Cancelar la venta ${order.code} de ${order.customer.name}? Las ${order.itemCount} prendas vuelven al stock.` +
              (order.paidAmount > 0 ? `\n\nOjo: tiene ${formatCurrency(order.paidAmount)} cobrados que dejan de contar.` : '');
        if (!window.confirm(question)) return;
        void runAction(
          order,
          () => updateOrderStatus(order.id, 'cancelled', session.password),
          order.status === 'confirmed',
          'No se pudo cancelar la venta.',
        );
        return;
      }
    }
  }

  function handleDeletePayment(order: Order, paymentId: string) {
    const payment = order.payments.find((p) => p.id === paymentId);
    if (!payment) return;
    if (!window.confirm(`¿Borrar el cobro de ${formatCurrency(payment.amount)} (${payment.methodLabel})? Deja de figurar como cobrado.`)) {
      return;
    }
    void runAction(order, () => deletePayment(order.id, paymentId, session.password), false, 'No se pudo borrar el cobro.');
  }

  if (form) {
    return (
      <AdminSaleForm
        key={form.mode === 'edit' ? form.order.id : 'nueva'}
        products={products}
        clients={clients}
        config={config}
        initial={form.mode === 'edit' ? form.order : undefined}
        appendLines={form.mode === 'edit' ? form.appendLines : undefined}
        openSales={pendingOrders ?? []}
        onCreateClient={onCreateClient}
        onCancel={() => setForm(null)}
        onSwitchToSale={(order, lines) => setForm({ mode: 'edit', order, appendLines: lines })}
        onSaved={(order, isNew) => {
          setForm(null);
          setSavedNotice(order);
          if (isNew && view === 'history') setView('today');
          afterChange(true);
        }}
      />
    );
  }

  const pendingWeb = (pendingOrders ?? []).filter((o) => o.status === 'pending');
  const toCollect = (pendingOrders ?? [])
    .filter((o) => o.status === 'confirmed' && balanceOf(o) > 0)
    .sort((a, b) => a.saleDate.localeCompare(b.saleDate));
  const toDeliver = (pendingOrders ?? [])
    .filter((o) => o.status === 'confirmed' && balanceOf(o) === 0 && o.delivery.status === 'pending')
    .sort((a, b) => a.saleDate.localeCompare(b.saleDate));
  const pendingCount = pendingWeb.length + toCollect.length + toDeliver.length;

  const renderCards = (list: Order[]) =>
    list.map((order) => (
      <SaleCard
        key={order.id}
        order={order}
        whatsapp={order.clientId ? clientById.get(order.clientId)?.whatsapp : undefined}
        isAdmin={isAdmin}
        isBusy={busyId === order.id}
        onAction={handleAction}
        onDeletePayment={handleDeletePayment}
      />
    ));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Vista de ventas">
          <Chip isActive={view === 'today'} onClick={() => setView('today')}>
            Hoy
          </Chip>
          <Chip isActive={view === 'pending'} onClick={() => setView('pending')}>
            {`Pendientes${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
          </Chip>
          <Chip isActive={view === 'history'} onClick={() => setView('history')}>
            Historial
          </Chip>
        </div>
        <Button
          onClick={() => {
            setSavedNotice(null);
            setForm({ mode: 'new' });
          }}
        >
          + Nueva venta
        </Button>
      </div>

      {savedNotice && <SavedNotice order={savedNotice} whatsapp={clientById.get(savedNotice.clientId ?? '')?.whatsapp} />}

      {error && (
        <Alert tone="error" onRetry={() => setReloadToken((t) => t + 1)}>
          {error}
        </Alert>
      )}

      {view === 'today' && (
        <TodayView
          orders={todayOrders}
          cash={cash}
          pendingWebCount={pendingWeb.length}
          onSeePending={() => setView('pending')}
          renderCards={renderCards}
        />
      )}

      {view === 'pending' &&
        (pendingOrders === null ? (
          <Loading />
        ) : pendingCount === 0 ? (
          <Empty title="No hay nada pendiente.">Todas las ventas están cobradas y entregadas.</Empty>
        ) : (
          <>
            {pendingWeb.length > 0 && (
              <Group title="Pedidos web para confirmar" detail={`${pendingWeb.length}`}>
                <p className="-mt-1 text-xs text-stone-600">
                  Llegan del catálogo. No descuentan stock hasta que los confirmes o cobres la seña.
                </p>
                {renderCards(pendingWeb)}
              </Group>
            )}
            {toCollect.length > 0 && (
              <Group
                title="Por cobrar"
                detail={`${toCollect.length} · ${formatCurrency(toCollect.reduce((s, o) => s + balanceOf(o), 0))}`}
              >
                {renderCards(toCollect)}
              </Group>
            )}
            {toDeliver.length > 0 && (
              <Group title="Pagadas, por enviar o entregar" detail={`${toDeliver.length}`}>
                {renderCards(toDeliver)}
              </Group>
            )}
          </>
        ))}

      {view === 'history' && (
        <HistoryView
          orders={historyOrders}
          range={range}
          onRangeChange={(next) => {
            setHistoryOrders(null);
            setRange(next);
          }}
          isAdmin={isAdmin}
          clients={clients}
          renderCards={renderCards}
        />
      )}

      <PaymentDialog
        order={paying}
        methods={config.paymentMethods}
        onClose={() => setPaying(null)}
        onSaved={() => {
          // Cobrar un pedido web sin confirmar lo confirma, y eso sí mueve el stock.
          const wasPending = paying?.status === 'pending';
          setPaying(null);
          setSavedNotice(null);
          afterChange(wasPending);
        }}
      />
    </div>
  );
}

function SavedNotice({ order, whatsapp }: { order: Order; whatsapp?: string }) {
  const balance = balanceOf(order);
  const url = buildWhatsAppChatUrl(whatsapp, buildSaleSummaryMessage(order, BUSINESS_NAME));
  return (
    <Alert tone="success" title={`Venta ${order.code} guardada · ${formatCurrency(order.total)}`}>
      <p>
        {order.customer.name} · {plural(order.itemCount, 'prenda', 'prendas')}
        {balance > 0 ? ` · queda debiendo ${formatCurrency(balance)}` : ' · pagada'}
      </p>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex min-h-11 items-center font-semibold underline underline-offset-2"
        >
          Mandarle el resumen por WhatsApp
        </a>
      )}
    </Alert>
  );
}

function TodayView({
  orders,
  cash,
  pendingWebCount,
  onSeePending,
  renderCards,
}: {
  orders: Order[] | null;
  cash: CashSummary | null;
  pendingWebCount: number;
  onSeePending: () => void;
  renderCards: (list: Order[]) => ReactNode;
}) {
  const [showCashDetail, setShowCashDetail] = useState(false);
  if (orders === null) return <Loading />;

  const confirmed = orders.filter((o) => o.status === 'confirmed');
  const sold = confirmed.reduce((s, o) => s + Math.max(0, o.subtotal - o.discount), 0);
  const units = confirmed.reduce((s, o) => s + o.itemCount, 0);
  const visible = orders.filter((o) => o.status !== 'cancelled');

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-3">
        <Stat label="Vendido hoy" value={formatCurrency(sold)} detail={`${plural(confirmed.length, 'venta', 'ventas')} · ${plural(units, 'prenda', 'prendas')}`} />
        <div className="rounded-xl border border-stone-200 bg-white p-3 sm:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">Caja de hoy (lo que entró)</p>
            <p className="font-heading text-xl font-semibold text-stone-900">{formatCurrency(cash?.total ?? 0)}</p>
          </div>
          {cash && cash.byMethod.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {cash.byMethod.map((m) => (
                <li key={m.methodId} className="flex justify-between gap-2 text-stone-700">
                  <span>
                    {m.label} <span className="text-stone-600">({m.count})</span>
                  </span>
                  <span className="font-semibold text-stone-900">{formatCurrency(m.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-stone-600">Todavía no entró plata hoy.</p>
          )}
          {cash && cash.payments.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowCashDetail((v) => !v)}
                aria-expanded={showCashDetail}
                className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-brand-700"
              >
                {showCashDetail ? 'Ocultar detalle' : 'Ver cada cobro'}
              </button>
              {showCashDetail && (
                <ul className="flex flex-col gap-0.5 text-xs text-stone-600">
                  {cash.payments.map((p, i) => (
                    <li key={`${p.orderId}-${i}`}>
                      {p.customerName} ({p.code}) · {p.methodLabel} · {formatCurrency(p.amount)}
                      {p.saleDate !== cash.date && ' · saldo de una venta anterior'}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      {pendingWebCount > 0 && (
        <Alert tone="warning">
          Hay {pendingWebCount} pedido{pendingWebCount === 1 ? '' : 's'} del catálogo web esperando.{' '}
          <button type="button" onClick={onSeePending} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
            Ver pendientes
          </button>
        </Alert>
      )}

      {visible.length === 0 ? (
        <Empty title="Todavía no hay ventas hoy.">Cargá la primera con “+ Nueva venta”.</Empty>
      ) : (
        renderCards(visible)
      )}
    </>
  );
}

function HistoryView({
  orders,
  range,
  onRangeChange,
  isAdmin,
  clients,
  renderCards,
}: {
  orders: Order[] | null;
  range: { from: string; to: string };
  onRangeChange: (range: { from: string; to: string }) => void;
  isAdmin: boolean;
  clients: ClientWithStats[];
  renderCards: (list: Order[]) => ReactNode;
}) {
  const today = todayAr();
  const [channel, setChannel] = useState<SaleChannel | 'all'>('all');
  const [showCancelled, setShowCancelled] = useState(false);
  const [search, setSearch] = useState('');

  const presets = [
    { label: 'Esta semana', from: startOfWeek(today), to: today },
    { label: 'Este mes', from: startOfMonth(today), to: today },
    { label: 'Mes pasado', from: startOfMonth(addDays(startOfMonth(today), -1)), to: endOfMonth(addDays(startOfMonth(today), -1)) },
  ];

  const filtered = useMemo(() => {
    if (!orders) return [];
    const needle = normalizeSearch(search);
    const tiktokById = new Map(clients.map((c) => [c.id, c.tiktok ?? '']));
    return orders.filter((o) => {
      if (!showCancelled && o.status === 'cancelled') return false;
      if (channel !== 'all' && o.channel !== channel) return false;
      if (!needle) return true;
      const haystack = normalizeSearch(
        [o.code, o.customer.name, o.seller ?? '', tiktokById.get(o.clientId ?? '') ?? '', ...o.lines.map((l) => l.productName)].join(' '),
      );
      return haystack.includes(needle);
    });
  }, [orders, search, channel, showCancelled, clients]);

  const confirmed = filtered.filter((o) => o.status === 'confirmed');
  const sold = confirmed.reduce((s, o) => s + Math.max(0, o.subtotal - o.discount), 0);
  const units = confirmed.reduce((s, o) => s + o.itemCount, 0);

  function exportCsv() {
    downloadTextFile(ordersToCsv(filtered, isAdmin), `ventas-${range.from}-a-${range.to}.csv`);
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-3">
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <Chip
              key={preset.label}
              isActive={range.from === preset.from && range.to === preset.to}
              onClick={() => onRangeChange({ from: preset.from, to: preset.to })}
            >
              {preset.label}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={LABEL_CLASS}>
            <span className={LABEL_TEXT_CLASS}>Desde</span>
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => e.target.value && onRangeChange({ ...range, from: e.target.value })}
              className={INPUT_CLASS}
            />
          </label>
          <label className={LABEL_CLASS}>
            <span className={LABEL_TEXT_CLASS}>Hasta</span>
            <input
              type="date"
              value={range.to}
              min={range.from}
              max={today}
              onChange={(e) => e.target.value && onRangeChange({ ...range, to: e.target.value })}
              className={INPUT_CLASS}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip isActive={channel === 'all'} onClick={() => setChannel('all')}>
            Todos los canales
          </Chip>
          {(Object.keys(CHANNEL_LABELS) as SaleChannel[]).map((c) => (
            <Chip key={c} isActive={channel === c} onClick={() => setChannel(c)}>
              {CHANNEL_LABELS[c]}
            </Chip>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por clienta, código, producto o vendedora…"
          aria-label="Buscar en el historial"
          className={INPUT_CLASS}
        />
        <label className="flex min-h-11 items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" className="h-5 w-5" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
          Mostrar canceladas
        </label>
      </div>

      {orders === null ? (
        <Loading />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-stone-700">
              <strong className="font-semibold text-stone-900">{plural(confirmed.length, 'venta', 'ventas')}</strong> ·{' '}
              <strong className="font-semibold text-stone-900">{formatCurrency(sold)}</strong> · {plural(units, 'prenda', 'prendas')}
            </p>
            <Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
              Descargar para Excel
            </Button>
          </div>
          {filtered.length === 0 ? (
            <Empty title="No hay ventas con esos filtros.">Probá con otro período o borrá la búsqueda.</Empty>
          ) : (
            renderCards(filtered)
          )}
        </>
      )}
    </>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">{label}</p>
      <p className="mt-1 font-heading text-xl font-semibold text-stone-900">{value}</p>
      {detail && <p className="text-xs text-stone-600">{detail}</p>}
    </div>
  );
}

function Group({ title, detail, children }: { title: string; detail?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-base font-semibold text-stone-900">
        {title} {detail && <span className="font-normal text-stone-600">· {detail}</span>}
      </h2>
      {children}
    </section>
  );
}

function Loading() {
  return <p className="py-10 text-center text-sm text-stone-600">Cargando ventas…</p>;
}

function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 px-4 py-10 text-center">
      <p className="text-sm font-semibold text-stone-700">{title}</p>
      {children && <p className="mt-1 text-xs text-stone-600">{children}</p>}
    </div>
  );
}
