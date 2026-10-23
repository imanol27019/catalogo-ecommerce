import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Order } from '../../types/order';
import type { Client, ClientPayload, ClientWithStats } from '../../types/sales';
import { fetchOrders } from '../../data/orders';
import { deleteClient, updateClient } from '../../data/sales';
import { formatCurrency, plural } from '../../utils/format';
import {
  balanceOf,
  buildWhatsAppChatUrl,
  CHANNEL_LABELS,
  daysBetween,
  formatDayLabel,
  matchesClient,
  normalizeSearch,
  paymentStateOf,
  relativeDay,
  todayAr,
} from '../../utils/sales';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { WhatsAppIcon } from '../ui/icons';
import { INPUT_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS, TEXTAREA_CLASS } from '../ui/formStyles';
import { describeApiError, useAdminSession } from './adminSession';

interface AdminClientsManagerProps {
  clients: ClientWithStats[];
  isLoading: boolean;
  loadError: string | null;
  onReload: () => void;
  onCreateClient: (payload: ClientPayload) => Promise<Client>;
}

type Sort = 'revenue' | 'recent' | 'owing' | 'inactive';

/** A partir de cuántos días sin comprar conviene volver a escribirle a una clienta. */
const INACTIVE_DAYS = 30;

export function AdminClientsManager({ clients, isLoading, loadError, onReload, onCreateClient }: AdminClientsManagerProps) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('revenue');
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null);
  const today = todayAr();

  const visible = useMemo(() => {
    const needle = normalizeSearch(search);
    let list = needle ? clients.filter((c) => matchesClient(c, needle)) : clients;
    if (sort === 'owing') list = list.filter((c) => c.stats.balance > 0);
    if (sort === 'inactive') {
      list = list.filter((c) => c.stats.lastDate && daysBetween(c.stats.lastDate, today) > INACTIVE_DAYS);
    }
    return [...list].sort((a, b) => {
      if (sort === 'recent') return (b.stats.lastDate ?? '').localeCompare(a.stats.lastDate ?? '');
      if (sort === 'owing') return b.stats.balance - a.stats.balance;
      if (sort === 'inactive') return (a.stats.lastDate ?? '').localeCompare(b.stats.lastDate ?? '');
      return b.stats.revenue - a.stats.revenue;
    });
  }, [clients, search, sort, today]);

  const owingTotal = clients.reduce((s, c) => s + c.stats.balance, 0);
  const selected = selectedId && selectedId !== 'new' ? clients.find((c) => c.id === selectedId) : undefined;

  if (selectedId === 'new') {
    return (
      <ClientForm
        title="Nueva clienta"
        onCancel={() => setSelectedId(null)}
        onSubmit={async (payload) => {
          const client = await onCreateClient(payload);
          setSelectedId(client.id);
        }}
      />
    );
  }

  if (selected) {
    return <ClientDetail client={selected} onBack={() => setSelectedId(null)} onChanged={onReload} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-700">
          <strong className="font-semibold text-stone-900">{plural(clients.length, 'clienta', 'clientas')}</strong>
          {owingTotal > 0 && (
            <>
              {' '}
              · te deben <strong className="font-semibold text-stock-low">{formatCurrency(owingTotal)}</strong>
            </>
          )}
        </p>
        <Button onClick={() => setSelectedId('new')}>+ Nueva clienta</Button>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nombre, @tiktok o WhatsApp…"
        aria-label="Buscar clienta"
        className={INPUT_CLASS}
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Orden de la lista">
        <Chip isActive={sort === 'revenue'} onClick={() => setSort('revenue')}>
          Las que más compran
        </Chip>
        <Chip isActive={sort === 'recent'} onClick={() => setSort('recent')}>
          Compraron hace poco
        </Chip>
        <Chip isActive={sort === 'owing'} onClick={() => setSort('owing')}>
          Deben plata
        </Chip>
        <Chip isActive={sort === 'inactive'} onClick={() => setSort('inactive')}>
          {`Sin comprar hace +${INACTIVE_DAYS} días`}
        </Chip>
      </div>

      {loadError && (
        <Alert tone="error" onRetry={onReload}>
          {loadError}
        </Alert>
      )}

      {isLoading ? (
        <p className="py-10 text-center text-sm text-stone-600">Cargando clientas…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-600">
          {clients.length === 0
            ? 'Todavía no hay clientas. Se crean al cargar una venta, o con “+ Nueva clienta”.'
            : 'No hay clientas que coincidan.'}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((client) => (
            <li key={client.id}>
              <button
                type="button"
                onClick={() => setSelectedId(client.id)}
                className="flex min-h-11 w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-stone-200 bg-white p-3 text-left hover:border-brand-300"
              >
                <span className="min-w-0">
                  <span className="block font-heading text-sm font-semibold text-stone-900">{client.name}</span>
                  <span className="block text-xs text-stone-600">
                    {[client.tiktok && `@${client.tiktok}`, client.locality].filter(Boolean).join(' · ') || 'Sin datos'}
                  </span>
                </span>
                <span className="flex flex-col items-end text-right">
                  <span className="text-sm font-semibold text-stone-900">{formatCurrency(client.stats.revenue)}</span>
                  <span className="text-xs text-stone-600">
                    {client.stats.salesCount} compra{client.stats.salesCount === 1 ? '' : 's'}
                    {client.stats.lastDate && ` · última ${relativeDay(client.stats.lastDate, today)}`}
                  </span>
                  {client.stats.balance > 0 && (
                    <span className="text-xs font-semibold text-stock-low">Debe {formatCurrency(client.stats.balance)}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClientDetail({ client, onBack, onChanged }: { client: ClientWithStats; onBack: () => void; onChanged: () => void }) {
  const session = useAdminSession();
  const [isEditing, setEditing] = useState(false);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    fetchOrders({ clientId: client.id }, session.password)
      .then((list) => {
        if (isCurrent) setOrders(list);
      })
      .catch((err: unknown) => {
        if (isCurrent) setError(describeApiError(err, session, 'No se pudo cargar el historial.'));
      });
    return () => {
      isCurrent = false;
    };
  }, [client.id, session]);

  const confirmed = useMemo(() => (orders ?? []).filter((o) => o.status === 'confirmed'), [orders]);
  const topProducts = useTopProducts(confirmed);

  if (isEditing) {
    return (
      <ClientForm
        title={`Editar a ${client.name}`}
        initial={client}
        onCancel={() => setEditing(false)}
        onSubmit={async (payload) => {
          await updateClient(client.id, payload, session.password);
          setEditing(false);
          onChanged();
        }}
      />
    );
  }

  const whatsappUrl = buildWhatsAppChatUrl(client.whatsapp, `Hola ${client.name.split(' ')[0]}! `);
  const avgTicket = client.stats.salesCount > 0 ? Math.round(client.stats.revenue / client.stats.salesCount) : 0;

  async function handleDelete() {
    if (!window.confirm(`¿Borrar la ficha de ${client.name}?`)) return;
    try {
      await deleteClient(client.id, session.password);
      onChanged();
      onBack();
    } catch (err) {
      setError(describeApiError(err, session, 'No se pudo borrar.'));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-stone-600 hover:text-stone-900"
      >
        ← Todas las clientas
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold text-stone-900">{client.name}</h2>
          <p className="text-sm text-stone-600">
            {[client.tiktok && `@${client.tiktok}`, client.whatsapp, client.locality].filter(Boolean).join(' · ') ||
              'Sin datos de contacto'}
          </p>
          {client.notes && <p className="mt-1 text-sm text-stone-700">{client.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 font-heading text-sm font-semibold text-whatsapp-dark hover:bg-stone-50"
            >
              <WhatsAppIcon className="h-4 w-4" />
              Escribirle
            </a>
          )}
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Editar datos
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Compró en total" value={formatCurrency(client.stats.revenue)} />
        <MiniStat label="Compras" value={String(client.stats.salesCount)} />
        <MiniStat label="Ticket promedio" value={formatCurrency(avgTicket)} />
        <MiniStat
          label="Debe"
          value={formatCurrency(client.stats.balance)}
          tone={client.stats.balance > 0 ? 'warning' : undefined}
        />
      </dl>

      {topProducts.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-3">
          <h3 className="font-heading text-sm font-semibold text-stone-900">Lo que más le compra</h3>
          <ul className="mt-1.5 flex flex-col gap-0.5 text-sm text-stone-700">
            {topProducts.map((p) => (
              <li key={p.name} className="flex justify-between gap-2">
                <span className="min-w-0 truncate">{p.name}</span>
                <span className="shrink-0 text-stone-600">{p.units} u.</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      <section className="flex flex-col gap-2">
        <h3 className="font-heading text-base font-semibold text-stone-900">Historial de compras</h3>
        {orders === null && !error ? (
          <p className="py-6 text-center text-sm text-stone-600">Cargando…</p>
        ) : (orders ?? []).length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-600">
            Todavía no tiene compras.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(orders ?? []).map((order) => {
              const state = paymentStateOf(order);
              return (
                <li key={order.id} className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-stone-900">
                      {formatDayLabel(order.saleDate)} · {order.code}{' '}
                      <span className="font-normal text-stone-600">· {CHANNEL_LABELS[order.channel]}</span>
                    </p>
                    <p className="font-heading font-semibold text-stone-900">{formatCurrency(order.total)}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-stone-600">
                    {order.lines
                      .map((l) => `${l.qty}x ${l.productName}${l.size || l.color ? ` (${[l.size, l.color].filter(Boolean).join('/')})` : ''}`)
                      .join(', ')}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {order.status === 'cancelled' ? (
                      <Badge tone="stock-out">Cancelada</Badge>
                    ) : order.status === 'pending' ? (
                      <Badge tone="stock-low">Sin confirmar</Badge>
                    ) : state === 'paid' ? (
                      <Badge tone="stock-in">Pagada</Badge>
                    ) : (
                      <Badge tone="stock-low">Debe {formatCurrency(balanceOf(order))}</Badge>
                    )}
                    {order.status === 'confirmed' && order.delivery.status === 'pending' && (
                      <Badge tone="brand">{order.delivery.method === 'shipping' ? 'Por enviar' : 'Por retirar'}</Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {session.role === 'admin' && client.stats.salesCount === 0 && (orders ?? []).length === 0 && orders !== null && (
        <Button variant="danger" className="self-start" onClick={() => void handleDelete()}>
          Borrar ficha
        </Button>
      )}
    </div>
  );
}

function useTopProducts(orders: Order[]) {
  return useMemo(() => {
    const map = new Map<string, number>();
    for (const order of orders) for (const line of order.lines) map.set(line.productName, (map.get(line.productName) ?? 0) + line.qty);
    return [...map.entries()]
      .map(([name, units]) => ({ name, units }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);
  }, [orders]);
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'warning' }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <dt className="text-xs text-stone-600">{label}</dt>
      <dd className={`font-heading text-base font-semibold ${tone === 'warning' ? 'text-stock-low' : 'text-stone-900'}`}>{value}</dd>
    </div>
  );
}

function ClientForm({
  title,
  initial,
  onCancel,
  onSubmit,
}: {
  title: string;
  initial?: Client;
  onCancel: () => void;
  onSubmit: (payload: ClientPayload) => Promise<void>;
}) {
  const session = useAdminSession();
  const [name, setName] = useState(initial?.name ?? '');
  const [tiktok, setTiktok] = useState(initial?.tiktok ?? '');
  const [whatsapp, setWhatsapp] = useState(initial?.whatsapp ?? '');
  const [locality, setLocality] = useState(initial?.locality ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Poné el nombre o apodo.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name, tiktok, whatsapp, locality, notes });
    } catch (err) {
      setError(describeApiError(err, session, 'No se pudo guardar.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <h2 className="font-heading text-lg font-semibold text-stone-900">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Nombre o apodo</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} />
        </label>
        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Usuario de TikTok</span>
          <input value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="@usuario" autoCapitalize="none" className={INPUT_CLASS} />
        </label>
        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>WhatsApp (549 + área + número)</span>
          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" className={INPUT_CLASS} />
        </label>
        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Localidad</span>
          <input value={locality} onChange={(e) => setLocality(e.target.value)} className={INPUT_CLASS} />
        </label>
        <label className={`${LABEL_CLASS} sm:col-span-2`}>
          <span className={LABEL_TEXT_CLASS}>Notas (talles que busca, cómo le gusta que le envíen…)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={TEXTAREA_CLASS} />
        </label>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}
