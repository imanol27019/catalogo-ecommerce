import { useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { Product } from '../../types/product';
import type { DeliveryMethod, Order, SaleChannel, SalePayload } from '../../types/order';
import type { Client, ClientPayload, ClientWithStats, SalesConfig } from '../../types/sales';
import { createSale, updateSale } from '../../data/orders';
import { resolveImageUrl } from '../../data/apiClient';
import { formatCurrency, plural } from '../../utils/format';
import { getEffectivePrice, unitPriceForQty } from '../../utils/pricing';
import {
  CHANNEL_LABELS,
  describeBagDeadline,
  isBagOpen,
  MANUAL_CHANNELS,
  normalizeSearch,
  readDeviceSeller,
  readLastChannel,
  relativeDay,
  rememberDeviceSeller,
  rememberLastChannel,
  todayAr,
} from '../../utils/sales';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Alert } from '../ui/Alert';
import { MoneyInput } from '../ui/MoneyInput';
import { INPUT_CLASS, INPUT_COMPACT_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS, TEXTAREA_CLASS } from '../ui/formStyles';
import { ClientPicker } from './ClientPicker';
import { DispatchFields } from './DispatchDialog';
import { dispatchDraftFrom, dispatchPayloadFrom, validateDispatch, type DispatchDraft } from '../../utils/dispatch';
import { describeApiError, useAdminSession } from './adminSession';

/** Renglón en edición. Sin `productId` es un artículo fuera del catálogo. */
export interface DraftLine {
  key: string;
  productId: string;
  variantId: string;
  qty: number;
  /** Precio cobrado a mano. `null` = el del catálogo, con sus escalones por cantidad. */
  priceOverride: number | null;
  /** Solo artículos fuera del catálogo. */
  name: string;
  unitCost: number | null;
}

type PaymentMode = 'full' | 'partial' | 'none';

interface DraftPayment {
  key: string;
  methodId: string;
  amount: number;
}

interface AdminSaleFormProps {
  products: Product[];
  clients: ClientWithStats[];
  config: SalesConfig;
  /** Venta a editar. Sin esto, es una venta nueva. */
  initial?: Order;
  /** Prendas que se venían cargando en otra venta y se suman a esta (ver `openSaleForClient`). */
  appendLines?: DraftLine[];
  /** Ventas con algo pendiente, para avisar si la clienta ya tiene una abierta. */
  openSales: Order[];
  onCreateClient: (payload: ClientPayload) => Promise<Client>;
  onCancel: () => void;
  onSaved: (order: Order, isNew: boolean) => void;
  /** Pasar a editar otra venta llevándose las prendas ya cargadas. */
  onSwitchToSale: (order: Order, lines: DraftLine[]) => void;
}

let keySeed = 0;
function newKey(): string {
  keySeed += 1;
  return `l${Date.now().toString(36)}${keySeed}`;
}

function linesFromOrder(order: Order, products: Product[]): DraftLine[] {
  return order.lines.map((line) => {
    const product = line.productId ? products.find((p) => p.id === line.productId) : undefined;
    const variantExists = product?.variants.some((v) => v.id === line.variantId);
    // Si el producto se borró del catálogo, el renglón pasa a "fuera del catálogo" con el precio
    // que se cobró: así la venta se puede seguir editando sin que el servidor la rechace.
    if (line.productId && (!product || !variantExists)) {
      const label = [line.productName, [line.size, line.color].filter(Boolean).join('/')].filter(Boolean).join(' ');
      return { key: newKey(), productId: '', variantId: '', qty: line.qty, priceOverride: line.unitPrice, name: label, unitCost: line.unitCost ?? null };
    }
    return {
      key: newKey(),
      productId: line.productId,
      variantId: line.productId ? line.variantId : '',
      qty: line.qty,
      // Un precio especial se conserva; uno de lista se recalcula, así si se suman prendas se
      // aplica el escalón por cantidad que corresponda.
      priceOverride: !line.productId || line.unitPrice !== line.listPrice ? line.unitPrice : null,
      name: line.productId ? '' : line.productName,
      unitCost: line.productId ? null : (line.unitCost ?? null),
    };
  });
}

function mergeLines(base: DraftLine[], extra: DraftLine[]): DraftLine[] {
  const result = base.map((l) => ({ ...l }));
  for (const line of extra) {
    const same = line.productId ? result.find((l) => l.productId === line.productId && l.variantId === line.variantId) : undefined;
    if (same) same.qty += line.qty;
    else result.push({ ...line, key: newKey() });
  }
  return result;
}

export function AdminSaleForm({
  products,
  clients,
  config,
  initial,
  appendLines,
  openSales,
  onCreateClient,
  onCancel,
  onSaved,
  onSwitchToSale,
}: AdminSaleFormProps) {
  const session = useAdminSession();
  const isEdit = Boolean(initial);
  const isConfirmed = initial?.status === 'confirmed';
  /** Bolsa de live todavía abierta: puede estar vacía y la seña puede superar lo que suma. */
  const bagOpen = initial ? isBagOpen(initial) : false;

  const [channel, setChannel] = useState<SaleChannel>(initial?.channel ?? readLastChannel());
  const [saleDate, setSaleDate] = useState(initial?.saleDate ?? todayAr());
  const [client, setClient] = useState<Client | null>(
    () => (initial?.clientId ? (clients.find((c) => c.id === initial.clientId) ?? null) : null),
  );
  const [seller, setSeller] = useState(() => {
    if (initial) return initial.seller ?? '';
    const remembered = readDeviceSeller();
    return config.sellers.includes(remembered) ? remembered : '';
  });
  const [lines, setLines] = useState<DraftLine[]>(() =>
    mergeLines(initial ? linesFromOrder(initial, products) : [], appendLines ?? []),
  );
  const [discount, setDiscount] = useState(initial?.discount ?? 0);
  const [shippingCost, setShippingCost] = useState(initial?.shippingCost ?? 0);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(
    initial?.delivery.method ?? (readLastChannel() === 'presencial' ? 'pickup' : 'shipping'),
  );
  const [isDelivered, setDelivered] = useState(
    initial ? initial.delivery.status === 'delivered' : readLastChannel() === 'presencial',
  );
  const [deliveryNote, setDeliveryNote] = useState(initial?.delivery.note ?? '');
  const [dispatch, setDispatch] = useState<DispatchDraft>(() =>
    dispatchDraftFrom(initial?.delivery ?? { method: 'shipping', status: 'pending' }),
  );
  const [bagClosesOn, setBagClosesOn] = useState(initial?.bag?.closesOn ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const firstMethod = config.paymentMethods[0]?.id ?? '';
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(readLastChannel() === 'presencial' ? 'full' : 'none');
  const [payments, setPayments] = useState<DraftPayment[]>([{ key: newKey(), methodId: firstMethod, amount: 0 }]);

  const [search, setSearch] = useState('');
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const sellableProducts = useMemo(() => products.filter((p) => p.status !== 'archived'), [products]);

  const visibleProducts = useMemo(() => {
    const needle = normalizeSearch(search);
    const list = needle
      ? sellableProducts.filter((p) => normalizeSearch(`${p.name} ${p.category}`).includes(needle))
      : sellableProducts;
    return list.slice(0, needle ? 12 : 8);
  }, [sellableProducts, search]);

  /** Unidades por producto: el escalón de precio se resuelve sobre el total, igual que en el servidor. */
  const qtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of lines) if (line.productId) map.set(line.productId, (map.get(line.productId) ?? 0) + line.qty);
    return map;
  }, [lines]);

  function listPriceOf(line: DraftLine): number {
    const product = productById.get(line.productId);
    if (!product) return line.priceOverride ?? 0;
    return unitPriceForQty(
      { unitPrice: getEffectivePrice(product), bulkPricing: product.bulkPricing },
      qtyByProduct.get(product.id) ?? line.qty,
    );
  }

  function unitPriceOf(line: DraftLine): number {
    return line.priceOverride ?? listPriceOf(line);
  }

  /** Unidades que ya descontó esta misma venta (al editar una confirmada vuelven a estar "disponibles" para ella). */
  function alreadyReserved(productId: string, variantId: string): number {
    if (!isConfirmed || !initial) return 0;
    return initial.lines
      .filter((l) => l.productId === productId && l.variantId === variantId)
      .reduce((sum, l) => sum + l.qty, 0);
  }

  const subtotal = lines.reduce((sum, line) => sum + unitPriceOf(line) * line.qty, 0);
  const appliedDiscount = Math.min(discount, subtotal);
  const appliedShipping = deliveryMethod === 'shipping' ? shippingCost : 0;
  const total = Math.max(0, subtotal - appliedDiscount + appliedShipping);
  const itemCount = lines.reduce((sum, l) => sum + l.qty, 0);

  const paymentRows = paymentMode === 'none' ? [] : payments;
  /** En "pagó todo" con un solo medio, el monto es el total y no se escribe. */
  const resolvedPayments = paymentRows.map((p, index) =>
    paymentMode === 'full' && index === 0
      ? { ...p, amount: Math.max(0, total - paymentRows.slice(1).reduce((s, x) => s + x.amount, 0)) }
      : p,
  );
  const paidNow = resolvedPayments.reduce((sum, p) => sum + p.amount, 0);

  const openSaleForClient = useMemo(() => {
    if (isEdit || !client) return null;
    return (
      openSales.find((o) => o.clientId === client.id && o.status === 'confirmed' && o.delivery.status === 'pending') ??
      null
    );
  }, [isEdit, client, openSales]);

  function changeChannel(next: SaleChannel) {
    setChannel(next);
    if (isEdit) return;
    // Lo habitual de cada canal: en el local se paga y se lleva en el momento; online se reserva,
    // se cobra después y se envía.
    const inStore = next === 'presencial';
    setDeliveryMethod(inStore ? 'pickup' : 'shipping');
    setDelivered(inStore);
    setPaymentMode(inStore ? 'full' : 'none');
  }

  function addVariant(productId: string, variantId: string) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === productId && l.variantId === variantId);
      if (existing) return prev.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { key: newKey(), productId, variantId, qty: 1, priceOverride: null, name: '', unitCost: null }];
    });
  }

  function addFreeLine() {
    setLines((prev) => [...prev, { key: newKey(), productId: '', variantId: '', qty: 1, priceOverride: 0, name: '', unitCost: null }]);
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function changeQty(key: string, update: (qty: number) => number) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, qty: Math.max(1, Math.min(9999, update(l.qty))) } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function updatePayment(key: string, patch: Partial<DraftPayment>) {
    setPayments((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  function validate(): string | null {
    if (lines.length === 0 && !bagOpen) return 'Agregá al menos una prenda.';
    for (const line of lines) {
      if (!line.productId && !line.name.trim()) return 'Poné el nombre del artículo fuera del catálogo.';
      if (!line.productId && !(line.priceOverride && line.priceOverride > 0)) {
        return `Poné el precio de "${line.name.trim() || 'el artículo'}".`;
      }
    }
    if ((channel === 'tiktok' || channel === 'whatsapp') && !client) {
      return 'Elegí o creá la clienta: en las ventas online hace falta para saber quién debe y a quién enviar.';
    }
    if (config.sellers.length > 0 && !seller) return 'Elegí quién hizo la venta.';
    if (!isEdit && paymentMode !== 'none') {
      if (paymentRows.some((p) => !p.methodId)) return 'Elegí el medio de cada pago.';
      if (paymentMode === 'partial' && paidNow <= 0) return 'Poné el monto de la seña, o elegí "No pagó todavía".';
      if (paidNow > total) return 'Lo cobrado supera el total de la venta.';
      if (paymentMode === 'full' && resolvedPayments.some((p) => p.amount <= 0)) {
        return 'Revisá los montos: con dos medios de pago, cada uno tiene que ser mayor a cero.';
      }
    }
    if (isDelivered && deliveryMethod === 'shipping') {
      const dispatchProblem = validateDispatch(dispatch);
      if (dispatchProblem) return dispatchProblem;
    }
    if (isEdit && initial && !bagOpen && total < initial.paidAmount) {
      return `Ya se cobraron ${formatCurrency(initial.paidAmount)}: el total no puede quedar por debajo de eso.`;
    }
    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    const payload: SalePayload = {
      channel,
      saleDate,
      clientId: client?.id ?? null,
      customer: { name: client?.name ?? initial?.customer.name ?? '', locality: client?.locality ?? initial?.customer.locality ?? '' },
      seller: seller || undefined,
      lines: lines.map((line) =>
        line.productId
          ? {
              productId: line.productId,
              variantId: line.variantId,
              qty: line.qty,
              ...(line.priceOverride !== null ? { unitPrice: line.priceOverride } : {}),
            }
          : {
              productId: '',
              variantId: '',
              qty: line.qty,
              unitPrice: line.priceOverride ?? 0,
              name: line.name.trim(),
              ...(line.unitCost ? { unitCost: line.unitCost } : {}),
            },
      ),
      discount: appliedDiscount,
      shippingCost: appliedShipping,
      delivery: {
        method: deliveryMethod,
        note: deliveryNote.trim(),
        // Retiro en el local: no hay transporte que elegir. Envío: lo que se cargó del despacho.
        ...(!isDelivered
          ? { status: 'pending' as const }
          : deliveryMethod === 'pickup'
            ? { status: 'delivered' as const, carrier: 'local' as const, deliveredAt: dispatch.deliveredAt }
            : dispatchPayloadFrom(dispatch)),
      },
      ...(bagOpen && bagClosesOn ? { bagClosesOn } : {}),
      notes: notes.trim(),
      ...(isEdit
        ? {}
        : {
            payments: resolvedPayments
              .filter((p) => p.amount > 0)
              .map((p) => ({ amount: p.amount, methodId: p.methodId, date: saleDate })),
          }),
    };

    setSaving(true);
    setError(null);
    try {
      const saved = initial ? await updateSale(initial.id, payload, session.password) : await createSale(payload, session.password);
      if (!isEdit) {
        rememberLastChannel(channel);
        if (seller) rememberDeviceSeller(seller);
      }
      onSaved(saved, !isEdit);
    } catch (err) {
      setError(describeApiError(err, session, 'No se pudo guardar la venta.'));
    } finally {
      setSaving(false);
    }
  }

  const channelOptions: SaleChannel[] = initial?.channel === 'web' ? [...MANUAL_CHANNELS, 'web'] : MANUAL_CHANNELS;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold text-stone-900">
          {isEdit ? `Editar venta ${initial?.code}` : 'Nueva venta'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-sm font-semibold text-stone-600 hover:text-stone-900"
        >
          Volver
        </button>
      </div>

      {isConfirmed && (
        <Alert tone="info">
          Si cambiás cantidades o sacás prendas, el stock se ajusta solo por la diferencia.
        </Alert>
      )}

      <Section title="¿Dónde se vendió?">
        <div className="flex flex-wrap gap-2">
          {channelOptions.map((option) => (
            <Chip key={option} isActive={channel === option} onClick={() => changeChannel(option)}>
              {CHANNEL_LABELS[option]}
            </Chip>
          ))}
        </div>
      </Section>

      <Section
        title="Clienta"
        hint={channel === 'presencial' ? 'Opcional en el local. Sirve para saber quién vuelve a comprar.' : undefined}
      >
        <ClientPicker clients={clients} value={client} onChange={setClient} onCreate={onCreateClient} channel={channel} />
        {openSaleForClient && (
          <Alert tone="warning" className="mt-2">
            <p>
              {client?.name} ya tiene una venta abierta ({openSaleForClient.code}, {plural(openSaleForClient.itemCount, 'prenda', 'prendas')},{' '}
              {relativeDay(openSaleForClient.saleDate)}).
            </p>
            <button
              type="button"
              onClick={() => onSwitchToSale(openSaleForClient, lines)}
              className="mt-1 inline-flex min-h-11 items-center font-semibold underline underline-offset-2"
            >
              Sumar estas prendas a esa venta
            </button>
          </Alert>
        )}
      </Section>

      <Section title="Prendas">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto…"
          aria-label="Buscar producto"
          // Enter en el buscador no tiene que mandar la venta a medio cargar.
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          className={INPUT_CLASS}
        />
        <ul className="mt-2 flex flex-col gap-1.5">
          {visibleProducts.map((product) => {
            const isOpen = openProductId === product.id;
            const units = product.variants.reduce((s, v) => s + v.stockQty, 0);
            return (
              <li key={product.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                <button
                  type="button"
                  onClick={() => setOpenProductId(isOpen ? null : product.id)}
                  aria-expanded={isOpen}
                  className="flex min-h-11 w-full items-center gap-3 px-2.5 py-1.5 text-left hover:bg-stone-50"
                >
                  {product.images[0] ? (
                    <img src={resolveImageUrl(product.images[0])} alt="" className="h-11 w-9 shrink-0 rounded object-cover" />
                  ) : (
                    <span aria-hidden="true" className="h-11 w-9 shrink-0 rounded bg-brand-100" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-stone-900">{product.name}</span>
                    <span className="block text-xs text-stone-600">
                      {formatCurrency(getEffectivePrice(product))} · {units} u. en stock
                      {product.status === 'draft' && ' · no publicado'}
                    </span>
                  </span>
                  <span aria-hidden="true" className={`shrink-0 text-stone-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    ▾
                  </span>
                </button>
                {isOpen && (
                  <div className="flex flex-wrap gap-1.5 border-t border-stone-100 p-2.5">
                    {product.variants.map((variant) => {
                      const inDraft = lines
                        .filter((l) => l.productId === product.id && l.variantId === variant.id)
                        .reduce((s, l) => s + l.qty, 0);
                      const available = variant.stockQty + alreadyReserved(product.id, variant.id) - inDraft;
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          disabled={available <= 0}
                          onClick={() => addVariant(product.id, variant.id)}
                          aria-label={`Agregar ${product.name} ${variant.size} ${variant.color}, quedan ${Math.max(0, available)}`}
                          className="min-h-11 rounded-lg border border-stone-300 px-2.5 text-xs font-medium text-stone-700 hover:border-brand-500 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-50 disabled:text-stone-500"
                        >
                          {[variant.size, variant.color].filter(Boolean).join(' / ')}
                          <span className="ml-1 text-stone-600">({Math.max(0, available)})</span>
                        </button>
                      );
                    })}
                    {product.variants.every((v) => v.stockQty + alreadyReserved(product.id, v.id) <= 0) && (
                      <p className="w-full text-xs text-stone-600">
                        Sin stock registrado. Si en realidad hay, sumalo en la pestaña Stock.
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {visibleProducts.length === 0 && (
            <li className="rounded-lg border border-dashed border-stone-300 px-3 py-4 text-center text-sm text-stone-600">
              No hay productos con ese nombre.
            </li>
          )}
        </ul>
        <button
          type="button"
          onClick={addFreeLine}
          className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          + Artículo fuera del catálogo
        </button>
      </Section>

      {lines.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-3">
          <p className="mb-2 font-heading text-sm font-semibold text-stone-900">
            Detalle <span className="font-normal text-stone-600">· {plural(itemCount, 'prenda', 'prendas')}</span>
          </p>
          <ul className="flex flex-col divide-y divide-stone-100">
            {lines.map((line) => (
              <LineRow
                key={line.key}
                line={line}
                product={productById.get(line.productId)}
                listPrice={listPriceOf(line)}
                unitPrice={unitPriceOf(line)}
                maxAvailable={
                  line.productId
                    ? (productById.get(line.productId)?.variants.find((v) => v.id === line.variantId)?.stockQty ?? 0) +
                      alreadyReserved(line.productId, line.variantId)
                    : null
                }
                showCost={session.role === 'admin'}
                onQty={(update) => changeQty(line.key, update)}
                onChange={(patch) => updateLine(line.key, patch)}
                onRemove={() => removeLine(line.key)}
              />
            ))}
          </ul>

          <div className="mt-3 grid gap-3 border-t border-stone-100 pt-3 sm:grid-cols-2">
            <label className={LABEL_CLASS}>
              <span className={LABEL_TEXT_CLASS}>Descuento sobre el total ($)</span>
              <MoneyInput value={discount} onChange={setDiscount} ariaLabel="Descuento" />
            </label>
            {deliveryMethod === 'shipping' && (
              <label className={LABEL_CLASS}>
                <span className={LABEL_TEXT_CLASS}>Envío que se le cobra ($)</span>
                <MoneyInput value={shippingCost} onChange={setShippingCost} ariaLabel="Envío" />
              </label>
            )}
          </div>

          <dl className="mt-3 flex flex-col gap-1 border-t border-stone-100 pt-3 text-sm">
            <TotalRow label="Subtotal" value={formatCurrency(subtotal)} />
            {appliedDiscount > 0 && <TotalRow label="Descuento" value={`−${formatCurrency(appliedDiscount)}`} />}
            {appliedShipping > 0 && <TotalRow label="Envío" value={formatCurrency(appliedShipping)} />}
            <div className="flex items-baseline justify-between font-heading text-base font-semibold text-stone-900">
              <dt>Total</dt>
              <dd className="text-brand-700">{formatCurrency(total)}</dd>
            </div>
          </dl>
        </div>
      )}

      <Section title="Pago">
        {isEdit && initial ? (
          <p className="text-sm text-stone-700">
            Cobrado {formatCurrency(initial.paidAmount)} de {formatCurrency(total)}
            {total - initial.paidAmount > 0 && (
              <span className="font-semibold text-stock-low"> · falta {formatCurrency(total - initial.paidAmount)}</span>
            )}
            . Los cobros se registran con el botón “Cobrar” de la venta.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Chip isActive={paymentMode === 'full'} onClick={() => setPaymentMode('full')}>
                Pagó todo
              </Chip>
              <Chip isActive={paymentMode === 'partial'} onClick={() => setPaymentMode('partial')}>
                Dejó una seña
              </Chip>
              <Chip isActive={paymentMode === 'none'} onClick={() => setPaymentMode('none')}>
                No pagó todavía
              </Chip>
            </div>

            {paymentMode !== 'none' && (
              <div className="mt-3 flex flex-col gap-3">
                {resolvedPayments.map((payment, index) => {
                  const isAuto = paymentMode === 'full' && index === 0;
                  return (
                    <div key={payment.key} className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-white p-2.5">
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Medio del pago ${index + 1}`}>
                        {config.paymentMethods.map((method) => (
                          <Chip
                            key={method.id}
                            isActive={payment.methodId === method.id}
                            onClick={() => updatePayment(payment.key, { methodId: method.id })}
                          >
                            {method.label}
                          </Chip>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        {isAuto ? (
                          <p className="flex min-h-11 flex-1 items-center gap-1 text-sm text-stone-700">
                            {resolvedPayments.length > 1 ? 'El resto: ' : ''}
                            <strong className="font-semibold text-stone-900">{formatCurrency(payment.amount)}</strong>
                          </p>
                        ) : (
                          <div className="flex-1">
                            <MoneyInput
                              value={payment.amount}
                              onChange={(amount) => updatePayment(payment.key, { amount })}
                              ariaLabel={`Monto del pago ${index + 1}`}
                            />
                          </div>
                        )}
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => setPayments((prev) => prev.filter((p) => p.key !== payment.key))}
                            aria-label="Quitar este pago"
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg text-stone-600 hover:bg-stone-100 hover:text-red-700"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {payments.length < 3 && (
                  <button
                    type="button"
                    onClick={() => setPayments((prev) => [...prev, { key: newKey(), methodId: firstMethod, amount: 0 }])}
                    className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-brand-700 hover:text-brand-800"
                  >
                    + Pagó con otro medio también
                  </button>
                )}
                {lines.length > 0 && paymentMode === 'partial' && paidNow < total && (
                  <p className="text-sm text-stone-700">
                    Queda debiendo <strong className="font-semibold text-stock-low">{formatCurrency(total - paidNow)}</strong>
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </Section>

      {bagOpen && initial ? (
        <Section title="Bolsa">
          <p className="mb-2 text-sm text-stone-700">{describeBagDeadline(initial)}. Se despacha cuando se cierra.</p>
          <label className={`${LABEL_CLASS} sm:max-w-xs`}>
            <span className={LABEL_TEXT_CLASS}>Abierta hasta el</span>
            <input
              type="date"
              value={bagClosesOn}
              min={initial.saleDate}
              onChange={(e) => e.target.value && setBagClosesOn(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
        </Section>
      ) : (
        <Section title="Entrega">
          <div className="flex flex-wrap gap-2">
            <Chip isActive={deliveryMethod === 'pickup'} onClick={() => setDeliveryMethod('pickup')}>
              Retira / se lo lleva
            </Chip>
            <Chip isActive={deliveryMethod === 'shipping'} onClick={() => setDeliveryMethod('shipping')}>
              Envío
            </Chip>
          </div>
          <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" className="h-5 w-5" checked={isDelivered} onChange={(e) => setDelivered(e.target.checked)} />
            {deliveryMethod === 'pickup' ? 'Ya se lo llevó' : 'Despacho realizado'}
          </label>
          {isDelivered && deliveryMethod === 'shipping' && (
            <div className="mt-1 rounded-lg border border-stone-200 bg-white p-3">
              <DispatchFields value={dispatch} onChange={setDispatch} />
            </div>
          )}
          <input
            value={deliveryNote}
            onChange={(e) => setDeliveryNote(e.target.value)}
            placeholder={deliveryMethod === 'shipping' ? 'Notas del envío: sucursal, dirección… (opcional)' : 'Quién retira, cuándo… (opcional)'}
            aria-label="Notas de la entrega"
            className={`${INPUT_CLASS} mt-2`}
          />
        </Section>
      )}

      <Section title="Datos de la venta">
        <div className="grid gap-3 sm:grid-cols-2">
          {config.sellers.length > 0 && (
            <div className="sm:col-span-2">
              <p className={`${LABEL_TEXT_CLASS} mb-1 text-sm`}>¿Quién vendió?</p>
              <div className="flex flex-wrap gap-2">
                {config.sellers.map((name) => (
                  <Chip key={name} isActive={seller === name} onClick={() => setSeller(name)}>
                    {name}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <label className={LABEL_CLASS}>
            <span className={LABEL_TEXT_CLASS}>Fecha de la venta</span>
            <input
              type="date"
              value={saleDate}
              max={todayAr()}
              onChange={(e) => e.target.value && setSaleDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className={`${LABEL_CLASS} sm:col-span-2`}>
            <span className={LABEL_TEXT_CLASS}>Notas (opcional)</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={TEXTAREA_CLASS} />
          </label>
        </div>
      </Section>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
        <p className="text-sm text-stone-700">
          <span className="block font-heading text-base font-semibold text-stone-900">{formatCurrency(total)}</span>
          {plural(itemCount, 'prenda', 'prendas')}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} className="hidden sm:inline-flex">
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Registrar venta'}
          </Button>
        </div>
      </div>
      {!isEdit && (
        <p className="-mt-2 text-xs text-stone-600">Al registrarla se descuenta el stock en el momento.</p>
      )}
    </form>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col">
      <h3 className="mb-1.5 font-heading text-sm font-semibold text-stone-900">{title}</h3>
      {hint && <p className="-mt-1 mb-1.5 text-xs text-stone-600">{hint}</p>}
      {children}
    </section>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-stone-700">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function LineRow({
  line,
  product,
  listPrice,
  unitPrice,
  maxAvailable,
  showCost,
  onQty,
  onChange,
  onRemove,
}: {
  line: DraftLine;
  product: Product | undefined;
  listPrice: number;
  unitPrice: number;
  maxAvailable: number | null;
  /** El costo solo lo carga la administradora: las vendedoras no lo ven. */
  showCost: boolean;
  onQty: (update: (qty: number) => number) => void;
  onChange: (patch: Partial<DraftLine>) => void;
  onRemove: () => void;
}) {
  const variant = product?.variants.find((v) => v.id === line.variantId);
  const isFree = !line.productId;
  const isSpecial = !isFree && line.priceOverride !== null && line.priceOverride !== listPrice;
  const overStock = maxAvailable !== null && line.qty > maxAvailable;
  const label = isFree ? 'artículo' : `${product?.name ?? ''} ${variant?.size ?? ''} ${variant?.color ?? ''}`.trim();

  return (
    <li className="flex flex-col gap-2 py-2.5">
      <div className="flex items-start gap-2">
        {isFree ? (
          <input
            value={line.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Nombre del artículo"
            aria-label="Nombre del artículo fuera del catálogo"
            className={`${INPUT_COMPACT_CLASS} min-w-0 flex-1`}
          />
        ) : (
          <p className="min-w-0 flex-1 pt-1 text-sm text-stone-800">
            <span className="font-semibold">{product?.name}</span>{' '}
            <span className="text-stone-600">{[variant?.size, variant?.color].filter(Boolean).join(' / ')}</span>
          </p>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar ${label}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg text-stone-600 hover:bg-stone-100 hover:text-red-700"
        >
          ×
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onQty((q) => q - 1)}
            aria-label={`Una menos de ${label}`}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-stone-300 text-lg text-stone-700 hover:bg-stone-50"
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={line.qty}
            onChange={(e) => onQty(() => Math.floor(Number(e.target.value)) || 1)}
            aria-label={`Cantidad de ${label}`}
            className={`min-h-11 w-14 rounded-lg border text-center text-sm font-semibold ${
              overStock ? 'border-stock-low text-stock-low' : 'border-stone-300 text-stone-900'
            }`}
          />
          <button
            type="button"
            onClick={() => onQty((q) => q + 1)}
            aria-label={`Una más de ${label}`}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-stone-300 text-lg text-stone-700 hover:bg-stone-50"
          >
            +
          </button>
        </div>
        <span className="text-sm text-stone-600">×</span>
        <MoneyInput
          value={unitPrice}
          onChange={(value) => onChange({ priceOverride: isFree || value !== listPrice ? value : null })}
          ariaLabel={`Precio por unidad de ${label}`}
          className="w-28"
        />
        <span className="ml-auto font-heading text-sm font-semibold text-stone-900">{formatCurrency(unitPrice * line.qty)}</span>
      </div>

      {isSpecial && (
        <p className="text-xs text-stone-600">
          Precio especial (lista: {formatCurrency(listPrice)}).{' '}
          <button
            type="button"
            onClick={() => onChange({ priceOverride: null })}
            className="inline-flex min-h-11 items-center font-semibold text-brand-700 underline underline-offset-2"
          >
            Volver al de lista
          </button>
        </p>
      )}
      {isFree && showCost && (
        <label className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
          Costo por unidad (opcional, para la ganancia)
          <MoneyInput
            value={line.unitCost ?? 0}
            onChange={(value) => onChange({ unitCost: value || null })}
            ariaLabel="Costo por unidad del artículo"
            className="w-28"
          />
        </label>
      )}
      {overStock && (
        <p className="text-xs text-stock-low">
          Hay {maxAvailable} u. registradas. Se puede vender igual: el stock queda en 0.
        </p>
      )}
    </li>
  );
}
