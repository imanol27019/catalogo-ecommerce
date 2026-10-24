import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Order, SaleChannel } from '../../types/order';
import type { Product } from '../../types/product';
import type { Client, ClientPayload, ClientWithStats, SalesConfig } from '../../types/sales';
import { changeSaleItem, createSale } from '../../data/orders';
import { resolveImageUrl } from '../../data/apiClient';
import { formatCurrency, plural } from '../../utils/format';
import { getEffectivePrice } from '../../utils/pricing';
import {
  addDays,
  balanceOf,
  CHANNEL_LABELS,
  creditOf,
  describeBagDeadline,
  formatDayLabel,
  normalizeSearch,
  readDeviceSeller,
  rememberDeviceSeller,
  todayAr,
} from '../../utils/sales';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Alert } from '../ui/Alert';
import { MoneyInput } from '../ui/MoneyInput';
import { INPUT_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from '../ui/formStyles';
import { ClientPicker } from './ClientPicker';
import { describeApiError, useAdminSession } from './adminSession';

const BAG_CHANNELS: SaleChannel[] = ['tiktok', 'whatsapp'];

interface OpenBagDialogProps {
  isOpen: boolean;
  clients: ClientWithStats[];
  config: SalesConfig;
  /** Bolsas abiertas, para avisar si la clienta ya tiene una. */
  openBags: Order[];
  onCreateClient: (payload: ClientPayload) => Promise<Client>;
  onClose: () => void;
  onOpened: (order: Order) => void;
  /** Ir a la bolsa que la clienta ya tiene abierta, en vez de abrirle otra. */
  onUseExisting: (order: Order) => void;
}

/**
 * Abrir la bolsa de una clienta del live: se carga cuando llega el comprobante de la seña. Desde
 * ese momento se le van sumando prendas durante los días que la bolsa queda abierta.
 */
export function OpenBagDialog(props: OpenBagDialogProps) {
  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="Abrir bolsa">
      {props.isOpen && <OpenBagForm {...props} />}
    </Modal>
  );
}

function OpenBagForm({ clients, config, openBags, onCreateClient, onClose, onOpened, onUseExisting }: OpenBagDialogProps) {
  const session = useAdminSession();
  const today = todayAr();
  const [channel, setChannel] = useState<SaleChannel>('tiktok');
  const [client, setClient] = useState<Client | null>(null);
  const [deposit, setDeposit] = useState(0);
  const [methodId, setMethodId] = useState(config.paymentMethods[0]?.id ?? '');
  const [seller, setSeller] = useState(() => {
    const remembered = readDeviceSeller();
    return config.sellers.includes(remembered) ? remembered : '';
  });
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingBag = client ? openBags.find((o) => o.clientId === client.id) : undefined;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!client) {
      setError('Elegí o creá la clienta.');
      return;
    }
    if (config.sellers.length > 0 && !seller) {
      setError('Elegí quién atiende el live.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const order = await createSale(
        {
          channel,
          saleDate: today,
          clientId: client.id,
          customer: { name: client.name, locality: client.locality ?? '' },
          seller: seller || undefined,
          lines: [],
          discount: 0,
          shippingCost: 0,
          payments: deposit > 0 ? [{ amount: deposit, methodId, date: today }] : [],
          delivery: { method: 'shipping', status: 'pending' },
          openBag: true,
        },
        session.password,
      );
      if (seller) rememberDeviceSeller(seller);
      onOpened(order);
    } catch (err) {
      setError(describeApiError(err, session, 'No se pudo abrir la bolsa.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Canal">
        {BAG_CHANNELS.map((option) => (
          <Chip key={option} isActive={channel === option} onClick={() => setChannel(option)}>
            {CHANNEL_LABELS[option]}
          </Chip>
        ))}
      </div>

      <div>
        <p className={`${LABEL_TEXT_CLASS} mb-1 text-sm`}>Clienta</p>
        <ClientPicker clients={clients} value={client} onChange={setClient} onCreate={onCreateClient} channel={channel} />
      </div>

      {existingBag ? (
        <Alert tone="warning">
          <p>
            {client?.name} ya tiene una bolsa abierta ({existingBag.code}, {plural(existingBag.itemCount, 'prenda', 'prendas')}).
          </p>
          <button
            type="button"
            onClick={() => onUseExisting(existingBag)}
            className="mt-1 inline-flex min-h-11 items-center font-semibold underline underline-offset-2"
          >
            Sumarle prendas a esa bolsa
          </button>
        </Alert>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <p className={`${LABEL_TEXT_CLASS} text-sm`}>Seña recibida</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Medio de la seña">
              {config.paymentMethods.map((method) => (
                <Chip key={method.id} isActive={methodId === method.id} onClick={() => setMethodId(method.id)}>
                  {method.label}
                </Chip>
              ))}
            </div>
            <MoneyInput value={deposit} onChange={setDeposit} ariaLabel="Monto de la seña" className="sm:max-w-xs" />
          </div>

          {config.sellers.length > 0 && (
            <div>
              <p className={`${LABEL_TEXT_CLASS} mb-1 text-sm`}>¿Quién atiende?</p>
              <div className="flex flex-wrap gap-2">
                {config.sellers.map((name) => (
                  <Chip key={name} isActive={seller === name} onClick={() => setSeller(name)}>
                    {name}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <p className="text-sm text-stone-700">
            La bolsa queda abierta hasta el{' '}
            <strong className="font-semibold">{formatDayLabel(addDays(today, config.bagDays))}</strong> (
            {plural(config.bagDays, 'día', 'días')}). Se puede extender desde “Editar”.
          </p>
        </>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        {!existingBag && (
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Abriendo…' : 'Abrir bolsa'}
          </Button>
        )}
      </div>
    </form>
  );
}

interface BagItemsDialogProps {
  order: Order | null;
  products: Product[];
  onClose: () => void;
  /** Cada prenda que se suma o se saca actualiza la venta en la lista. */
  onChanged: (order: Order) => void;
}

/**
 * Modo live: la clienta pide una prenda que se está mostrando y se toca el talle/color para
 * guardarla en su bolsa. Se guarda en el momento (no hay que apretar "guardar"), y el stock baja
 * ahí mismo para que no se le ofrezca a otra.
 */
export function BagItemsDialog({ order, products, onClose, onChanged }: BagItemsDialogProps) {
  return (
    <Modal
      isOpen={order !== null}
      onClose={onClose}
      title={order ? `Bolsa de ${order.customer.name}` : 'Bolsa'}
      maxWidthClassName="sm:max-w-2xl"
    >
      {order && <BagItemsPanel key={order.id} initial={order} products={products} onChanged={onChanged} onClose={onClose} />}
    </Modal>
  );
}

function BagItemsPanel({
  initial,
  products,
  onChanged,
  onClose,
}: {
  initial: Order;
  products: Product[];
  onChanged: (order: Order) => void;
  onClose: () => void;
}) {
  const session = useAdminSession();
  const [order, setOrder] = useState(initial);
  const [search, setSearch] = useState('');
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  /**
   * El catálogo del panel se refresca recién al cerrar esta ventana, así que lo que se fue sumando
   * acá se descuenta a mano para mostrar cuántas quedan de cada talle/color.
   */
  const [sessionDelta, setSessionDelta] = useState<Map<string, number>>(new Map());

  const visibleProducts = useMemo(() => {
    const needle = normalizeSearch(search);
    const list = products.filter((p) => p.status !== 'archived');
    return (needle ? list.filter((p) => normalizeSearch(`${p.name} ${p.category}`).includes(needle)) : list).slice(0, 12);
  }, [products, search]);

  function available(productId: string, variantId: string, stockQty: number): number {
    return stockQty - (sessionDelta.get(`${productId}::${variantId}`) ?? 0);
  }

  async function change(productId: string, variantId: string, qty: number, label: string) {
    const key = `${productId}::${variantId}`;
    setBusyKey(key);
    try {
      const updated = await changeSaleItem(order.id, { productId, variantId, qty }, session.password);
      setOrder(updated);
      onChanged(updated);
      setSessionDelta((prev) => new Map(prev).set(key, (prev.get(key) ?? 0) + qty));
      setFeedback({ tone: 'success', text: `${qty > 0 ? 'Sumada' : 'Sacada'}: ${label}` });
    } catch (err) {
      const message = describeApiError(err, session, 'No se pudo actualizar la bolsa.');
      if (message) setFeedback({ tone: 'error', text: message });
    } finally {
      setBusyKey(null);
    }
  }

  const balance = balanceOf(order);
  const credit = creditOf(order);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-stone-700">
        <p>
          <strong className="font-semibold text-stone-900">{plural(order.itemCount, 'prenda', 'prendas')}</strong> ·{' '}
          {formatCurrency(order.total)} · señó {formatCurrency(order.paidAmount)}
          {balance > 0 && <strong className="font-semibold text-stock-low"> · debe {formatCurrency(balance)}</strong>}
          {credit > 0 && <span> · {formatCurrency(credit)} a favor</span>}
        </p>
        <p className="text-xs text-stone-600">{describeBagDeadline(order)}</p>
      </div>

      <p role="status" aria-live="polite" className={`min-h-5 text-sm ${feedback?.tone === 'error' ? 'text-red-700' : 'text-stock-in'}`}>
        {feedback ? `${feedback.tone === 'success' ? '✓ ' : ''}${feedback.text}` : ''}
      </p>

      {order.lines.length > 0 && (
        <ul className="flex flex-col divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white px-3">
          {order.lines.map((line) => {
            const key = `${line.productId}::${line.variantId}`;
            const label = `${line.productName} ${[line.size, line.color].filter(Boolean).join(' / ')}`.trim();
            return (
              <li key={key + line.productName} className="flex items-center gap-2 py-1.5">
                <span className="min-w-0 flex-1 text-sm text-stone-800">
                  <span className="font-semibold">{line.qty}x</span> {label}
                </span>
                <span className="shrink-0 text-sm text-stone-700">{formatCurrency(line.subtotal)}</span>
                {line.productId && (
                  <button
                    type="button"
                    disabled={busyKey !== null}
                    onClick={() => void change(line.productId, line.variantId, -1, label)}
                    aria-label={`Sacar una de ${label}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-stone-300 text-lg text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                  >
                    −
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Sumar prendas</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar la prenda que se está mostrando…"
            className={INPUT_CLASS}
          />
        </label>
        <ul className="mt-2 flex flex-col gap-1.5">
          {visibleProducts.map((product) => {
            const isOpen = openProductId === product.id;
            return (
              <li key={product.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                <button
                  type="button"
                  onClick={() => setOpenProductId(isOpen ? null : product.id)}
                  aria-expanded={isOpen}
                  className="flex min-h-11 w-full items-center gap-3 px-2.5 py-1.5 text-left hover:bg-stone-50"
                >
                  {product.images[0] ? (
                    <img src={resolveImageUrl(product.images[0])} alt="" className="h-12 w-10 shrink-0 rounded object-cover" />
                  ) : (
                    <span aria-hidden="true" className="h-12 w-10 shrink-0 rounded bg-brand-100" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-stone-900">{product.name}</span>
                    <span className="block text-xs text-stone-600">{formatCurrency(getEffectivePrice(product))}</span>
                  </span>
                  <span aria-hidden="true" className={`shrink-0 text-stone-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    ▾
                  </span>
                </button>
                {isOpen && (
                  <div className="flex flex-wrap gap-1.5 border-t border-stone-100 p-2.5">
                    {product.variants.map((variant) => {
                      const left = available(product.id, variant.id, variant.stockQty);
                      const label = `${product.name} ${[variant.size, variant.color].filter(Boolean).join(' / ')}`;
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          disabled={left <= 0 || busyKey !== null}
                          onClick={() => void change(product.id, variant.id, 1, label)}
                          aria-label={`Sumar ${label} a la bolsa, quedan ${Math.max(0, left)}`}
                          className="min-h-11 rounded-lg border border-stone-300 px-3 text-sm font-medium text-stone-700 hover:border-brand-500 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-50 disabled:text-stone-500"
                        >
                          {[variant.size, variant.color].filter(Boolean).join(' / ')}
                          <span className="ml-1 text-stone-600">({Math.max(0, left)})</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={onClose}>
          Listo
        </Button>
      </div>
    </div>
  );
}
