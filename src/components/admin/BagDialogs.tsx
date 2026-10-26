import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Order, SaleChannel } from '../../types/order';
import type { Product } from '../../types/product';
import type { Client, ClientPayload, ClientWithStats, SalesConfig } from '../../types/sales';
import { changeSaleItems, createSale, type SaleItemChange } from '../../data/orders';
import { formatCurrency, plural } from '../../utils/format';
import {
  addDays,
  balanceOf,
  CHANNEL_LABELS,
  creditOf,
  describeBagDeadline,
  formatDayLabel,
  readDeviceSeller,
  rememberDeviceSeller,
  todayAr,
} from '../../utils/sales';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Alert } from '../ui/Alert';
import { MoneyInput } from '../ui/MoneyInput';
import { LABEL_TEXT_CLASS } from '../ui/formStyles';
import { ClientPicker } from './ClientPicker';
import { VariantQtyPicker } from './VariantQtyPicker';
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
    if (session.sellerName) return session.sellerName;
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
    if (!session.sellerName && config.sellers.length > 0 && !seller) {
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

          {!session.sellerName && config.sellers.length > 0 && (
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
 * Armado de la bolsa: se eligen las prendas que pide la clienta (varias, con cantidad por talle y
 * color) y entran todas juntas. El stock baja en ese momento para que no se le ofrezcan a otra.
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
  const [isBusy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  /**
   * El catálogo del panel se refresca recién al cerrar esta ventana, así que lo que se fue sumando
   * acá se descuenta a mano para mostrar cuántas quedan de cada talle/color.
   */
  const [sessionDelta, setSessionDelta] = useState<Map<string, number>>(new Map());

  async function apply(items: SaleItemChange[], successText: string): Promise<boolean> {
    setBusy(true);
    try {
      const updated = await changeSaleItems(order.id, items, session.password);
      setOrder(updated);
      onChanged(updated);
      setSessionDelta((prev) => {
        const next = new Map(prev);
        for (const item of items) {
          const k = `${item.productId}::${item.variantId}`;
          next.set(k, (next.get(k) ?? 0) + item.qty);
        }
        return next;
      });
      setFeedback({ tone: 'success', text: successText });
      return true;
    } catch (err) {
      const message = describeApiError(err, session, 'No se pudo actualizar la bolsa.');
      if (message) setFeedback({ tone: 'error', text: message });
      return false;
    } finally {
      setBusy(false);
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
            const label = `${line.productName} ${[line.size, line.color].filter(Boolean).join(' / ')}`.trim();
            return (
              <li key={`${line.productId}::${line.variantId}::${line.productName}`} className="flex items-center gap-2 py-1.5">
                <span className="min-w-0 flex-1 text-sm text-stone-800">
                  <span className="font-semibold">{line.qty}x</span> {label}
                </span>
                <span className="shrink-0 text-sm text-stone-700">{formatCurrency(line.subtotal)}</span>
                {line.productId && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      void apply([{ productId: line.productId, variantId: line.variantId, qty: -1 }], `Sacada: ${label}`)
                    }
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

      <section>
        <h3 className="mb-1.5 font-heading text-sm font-semibold text-stone-900">Sumar prendas</h3>
        <VariantQtyPicker
          products={products}
          availableOf={(product, variantId) =>
            (product.variants.find((v) => v.id === variantId)?.stockQty ?? 0) -
            (sessionDelta.get(`${product.id}::${variantId}`) ?? 0)
          }
          addLabel={(units) => `Agregar ${units} a la bolsa`}
          isBusy={isBusy}
          onAdd={(items) => {
            const units = items.reduce((sum, item) => sum + item.qty, 0);
            return apply(items, `Se sumaron ${plural(units, 'prenda', 'prendas')} a la bolsa`);
          }}
        />
      </section>

      <div className="flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Listo
        </Button>
      </div>
    </div>
  );
}
