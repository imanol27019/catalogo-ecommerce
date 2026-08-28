import { useEffect, useMemo, useState } from 'react';
import type { Order, OrderStatus } from '../../types/order';
import type { Product } from '../../types/product';
import { fetchOrders, updateOrderStatus } from '../../data/orders';
import { ApiError } from '../../data/apiClient';
import { formatCurrency } from '../../utils/format';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { AdminManualSaleForm } from './AdminManualSaleForm';

interface AdminSalesManagerProps {
  products: Product[];
  adminPassword: string;
  onAuthError: () => void;
  /** Se llama tras cualquier cambio de stock para refrescar el catálogo del panel. */
  onStockChanged: () => void;
}

type StatusFilter = 'pending' | 'confirmed' | 'all';

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'A confirmar',
  confirmed: 'Vendida',
  cancelled: 'Descartada',
};

const STATUS_TONES: Record<OrderStatus, 'stock-low' | 'stock-in' | 'stock-out'> = {
  pending: 'stock-low',
  confirmed: 'stock-in',
  cancelled: 'stock-out',
};

export function AdminSalesManager({ products, adminPassword, onAuthError, onStockChanged }: AdminSalesManagerProps) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isCreating, setCreating] = useState(false);

  async function load() {
    try {
      setOrders(await fetchOrders(adminPassword));
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onAuthError();
        return;
      }
      setError(err instanceof ApiError ? err.userMessage : 'No se pudieron cargar las ventas.');
    }
  }

  useEffect(() => {
    void load();
    // Se carga una sola vez al entrar; el resto de las actualizaciones son explícitas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    if (!orders) return [];
    if (filter === 'all') return orders;
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  const pendingCount = orders?.filter((o) => o.status === 'pending').length ?? 0;

  async function resolve(order: Order, status: 'confirmed' | 'cancelled') {
    if (
      status === 'confirmed' &&
      !window.confirm(`¿Registrar la venta ${order.code} como cobrada? Recién ahí se descuenta el stock.`)
    ) {
      return;
    }
    setBusyId(order.id);
    try {
      await updateOrderStatus(order.id, status, adminPassword);
      await load();
      if (status === 'confirmed') onStockChanged();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onAuthError();
        return;
      }
      setError(err instanceof ApiError ? err.userMessage : 'No se pudo actualizar la venta.');
    } finally {
      setBusyId(null);
    }
  }

  if (isCreating) {
    return (
      <AdminManualSaleForm
        products={products}
        adminPassword={adminPassword}
        onCancel={() => setCreating(false)}
        onAuthError={onAuthError}
        onSaved={async () => {
          setCreating(false);
          await load();
          onStockChanged();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Chip isActive={filter === 'pending'} onClick={() => setFilter('pending')}>
            {`Pedidos web${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
          </Chip>
          <Chip isActive={filter === 'confirmed'} onClick={() => setFilter('confirmed')}>
            Vendidas
          </Chip>
          <Chip isActive={filter === 'all'} onClick={() => setFilter('all')}>
            Todas
          </Chip>
        </div>
        <Button onClick={() => setCreating(true)}>+ Cargar venta</Button>
      </div>

      <Alert tone="info">
        El stock <strong>solo</strong> se descuenta cuando registrás la venta acá. Los pedidos que llegan del
        catálogo son consultas: quedan a la espera hasta que cobres la seña o el total.
      </Alert>

      {error && (
        <Alert tone="error" onRetry={() => void load()}>
          {error}
        </Alert>
      )}

      {orders === null ? (
        <p className="py-10 text-center text-sm text-stone-500">Cargando ventas…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 px-4 py-10 text-center">
          <p className="text-sm text-stone-600">
            {filter === 'pending' ? 'No hay pedidos web esperando.' : 'Todavía no hay ventas registradas.'}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Los pedidos que te hagan desde el catálogo aparecen acá. También podés cargar una venta de mostrador
            con "+ Cargar venta".
          </p>
        </div>
      ) : (
        visible.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            isBusy={busyId === order.id}
            onResolve={resolve}
          />
        ))
      )}
    </div>
  );
}


function OrderCard({
  order,
  isBusy,
  onResolve,
}: {
  order: Order;
  isBusy: boolean;
  onResolve: (order: Order, status: 'confirmed' | 'cancelled') => void;
}) {
  const date = new Date(order.createdAt);

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading text-sm font-semibold text-stone-900">
            {order.customer.name} <span className="font-normal text-stone-500">· {order.code}</span>
          </p>
          <p className="text-xs text-stone-500">
            {date.toLocaleDateString('es-AR')} {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            {order.customer.locality && ` · ${order.customer.locality}`}
            {order.source === 'manual' ? ' · mostrador' : ' · web'}
          </p>
        </div>
        <Badge tone={STATUS_TONES[order.status]}>{STATUS_LABELS[order.status]}</Badge>
      </div>

      <ul className="mt-3 flex flex-col gap-1 border-t border-stone-100 pt-3 text-sm">
        {order.lines.map((line) => (
          <li key={line.variantId} className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 text-stone-700">
              <span className="font-semibold">{line.qty}x</span> {line.productName}
              <span className="text-stone-500">
                {' '}
                ({line.size}/{line.color})
              </span>
            </span>
            <span className="shrink-0 font-medium text-stone-900">{formatCurrency(line.subtotal)}</span>
          </li>
        ))}
      </ul>

      {order.customer.shippingMethodLabel && (
        <p className="mt-2 text-xs text-stone-500">Envío: {order.customer.shippingMethodLabel}</p>
      )}
      {order.customer.comment && (
        <p className="mt-1 text-xs text-stone-500">Comentario: {order.customer.comment}</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-stone-100 pt-3">
        <span className="font-heading text-base font-semibold text-brand-600">
          {formatCurrency(order.total)}
          <span className="ml-1.5 text-xs font-normal text-stone-500">({order.itemCount} u.)</span>
        </span>

        {order.status === 'pending' && (
          <div className="flex gap-2">
            <Button variant="danger" disabled={isBusy} onClick={() => onResolve(order, 'cancelled')}>
              Descartar
            </Button>
            <Button disabled={isBusy} onClick={() => onResolve(order, 'confirmed')}>
              {isBusy ? 'Guardando…' : 'Registrar venta'}
            </Button>
          </div>
        )}
      </div>

      {order.status === 'pending' && (
        <p className="mt-2 text-xs text-stone-500">
          Registrala cuando tengas la seña o el pago: ahí se descuenta el stock.
        </p>
      )}
    </div>
  );
}
