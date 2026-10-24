import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Order } from '../../types/order';
import type { PaymentMethod } from '../../types/sales';
import { addPayment } from '../../data/orders';
import { formatCurrency } from '../../utils/format';
import { balanceOf, creditOf, isBagOpen, todayAr } from '../../utils/sales';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Alert } from '../ui/Alert';
import { MoneyInput } from '../ui/MoneyInput';
import { INPUT_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from '../ui/formStyles';
import { describeApiError, useAdminSession } from './adminSession';

interface PaymentDialogProps {
  order: Order | null;
  methods: PaymentMethod[];
  onClose: () => void;
  onSaved: (order: Order) => void;
}

/** Registrar un cobro: por defecto, todo lo que falta, que es el caso más común. */
export function PaymentDialog({ order, methods, onClose, onSaved }: PaymentDialogProps) {
  return (
    <Modal isOpen={order !== null} onClose={onClose} title={order ? `Cobrar venta ${order.code}` : 'Cobrar'}>
      {order && <PaymentForm key={order.id} order={order} methods={methods} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function PaymentForm({ order, methods, onClose, onSaved }: Omit<PaymentDialogProps, 'order'> & { order: Order }) {
  const session = useAdminSession();
  const balance = balanceOf(order);
  // En una bolsa abierta se puede señar de más: lo que sobra queda a favor para las próximas prendas.
  const bagOpen = isBagOpen(order);
  const [amount, setAmount] = useState(balance);
  const [methodId, setMethodId] = useState(methods[0]?.id ?? '');
  const [date, setDate] = useState(todayAr());
  const [note, setNote] = useState('');
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (amount <= 0) {
      setError('Poné cuánto pagó.');
      return;
    }
    if (!bagOpen && amount > balance) {
      setError(`No puede pagar más de lo que debe (${formatCurrency(balance)}).`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(await addPayment(order.id, { amount, methodId, date, note: note.trim() }, session.password));
    } catch (err) {
      setError(describeApiError(err, session, 'No se pudo registrar el cobro.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-stone-700">
        <p className="font-semibold text-stone-900">{order.customer.name}</p>
        <p>
          Total {formatCurrency(order.total)} · pagó {formatCurrency(order.paidAmount)}
          {balance > 0 && <strong className="font-semibold text-stock-low"> · debe {formatCurrency(balance)}</strong>}
          {creditOf(order) > 0 && <span> · {formatCurrency(creditOf(order))} a favor</span>}
        </p>
        {bagOpen && <p className="mt-0.5 text-xs text-stone-600">Bolsa abierta: puede pagar de más y queda a favor.</p>}
      </div>

      {order.status === 'pending' && (
        <Alert tone="info">Es un pedido web sin confirmar: al registrar el cobro queda confirmado y se descuenta el stock.</Alert>
      )}

      <div>
        <p className={`${LABEL_TEXT_CLASS} mb-1 text-sm`}>¿Con qué pagó?</p>
        <div className="flex flex-wrap gap-2">
          {methods.map((method) => (
            <Chip key={method.id} isActive={methodId === method.id} onClick={() => setMethodId(method.id)}>
              {method.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Monto</span>
          <MoneyInput value={amount} onChange={setAmount} ariaLabel="Monto cobrado" />
        </label>
        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Fecha del cobro</span>
          <input
            type="date"
            value={date}
            max={todayAr()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className={INPUT_CLASS}
          />
        </label>
      </div>
      {amount !== balance && balance > 0 && (
        <button
          type="button"
          onClick={() => setAmount(balance)}
          className="-mt-2 inline-flex min-h-11 items-center self-start text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          Cobrar todo lo que debe ({formatCurrency(balance)})
        </button>
      )}

      <label className={LABEL_CLASS}>
        <span className={LABEL_TEXT_CLASS}>Nota (opcional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: comprobante 1234" className={INPUT_CLASS} />
      </label>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Guardando…' : `Registrar ${formatCurrency(amount)}`}
        </Button>
      </div>
    </form>
  );
}
