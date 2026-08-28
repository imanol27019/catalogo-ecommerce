import { useEffect, useMemo, useState } from 'react';
import type { Order, OrderStatus } from '../../types/order';
import type { Product } from '../../types/product';
import { fetchOrders, updateOrderStatus } from '../../data/orders';
import { ApiError } from '../../data/apiClient';
import { formatCurrency } from '../../utils/format';
import { Button } from '../ui/Button';
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
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
};

const STATUS_CLASSES: Record<OrderStatus, string> = {
  pending: 'bg-stock-low-soft text-stock-low',
  confirmed: 'bg-stock-in-soft text-stock-in',
  cancelled: 'bg-stock-out-soft text-stock-out',
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
      setError('No se pudieron cargar las ventas. Revisá tu conexión.');
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
    if (status === 'confirmed' && !window.confirm(`¿Confirmar la venta ${order.code}? Se va a descontar el stock.`)) {
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
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la venta.');
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
          <FilterChip isActive={filter === 'pending'} onClick={() => setFilter('pending')}>
            {`Pendientes${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
          </FilterChip>
          <FilterChip isActive={filter === 'confirmed'} onClick={() => setFilter('confirmed')}>
            Confirmadas
          </FilterChip>
          <FilterChip isActive={filter === 'all'} onClick={() => setFilter('all')}>
            Todas
          </FilterChip>
        </div>
        <Button onClick={() => setCreating(true)}>+ Cargar venta</Button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>
      )}

      {orders === null ? (
        <p className="py-10 text-center text-sm text-stone-500">Cargando ventas…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 px-4 py-10 text-center">
          <p className="text-sm text-stone-600">
            {filter === 'pending' ? 'No hay pedidos pendientes.' : 'Todavía no hay ventas registradas.'}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Los pedidos que te hagan desde el catálogo aparecen acá para que los confirmes.
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

function FilterChip({ isActive, onClick, children }: { isActive: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        isActive
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'
      }`}
    >
      {children}
    </button>
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
            {order.customer.name} <span className="font-normal text-stone-400">· {order.code}</span>
          </p>
          <p className="text-xs text-stone-500">
            {date.toLocaleDateString('es-AR')} {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            {order.customer.locality && ` · ${order.customer.locality}`}
            {order.source === 'manual' ? ' · mostrador' : ' · web'}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[order.status]}`}>
          {STATUS_LABELS[order.status]}
        </span>
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
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onResolve(order, 'cancelled')}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <Button disabled={isBusy} onClick={() => onResolve(order, 'confirmed')}>
              {isBusy ? 'Guardando…' : 'Confirmar venta'}
            </Button>
          </div>
        )}
      </div>

      {order.status === 'pending' && (
        <p className="mt-2 text-xs text-stone-500">Al confirmar se descuenta el stock automáticamente.</p>
      )}
    </div>
  );
}
