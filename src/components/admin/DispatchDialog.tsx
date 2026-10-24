import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Carrier, Order, ShippingPayment } from '../../types/order';
import { dispatchSale } from '../../data/orders';
import { CARRIER_LABELS, SHIPPING_PAYMENT_LABELS, todayAr } from '../../utils/sales';
import { dispatchDraftFrom, dispatchPayloadFrom, validateDispatch, type DispatchDraft } from '../../utils/dispatch';
import { plural } from '../../utils/format';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Alert } from '../ui/Alert';
import { INPUT_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from '../ui/formStyles';
import { describeApiError, useAdminSession } from './adminSession';

const CARRIER_ORDER: Carrier[] = ['via-cargo', 'correo-argentino', 'local', 'andreani', 'otro'];

/**
 * Campos del despacho: cómo salió, el seguimiento (si corresponde) y quién paga el envío. Se usan
 * en la ventana de "Despacho realizado" y en el formulario de la venta.
 */
export function DispatchFields({ value, onChange }: { value: DispatchDraft; onChange: (draft: DispatchDraft) => void }) {
  const isCarrier = value.carrier !== null && value.carrier !== 'local';
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className={`${LABEL_TEXT_CLASS} mb-1 text-sm`}>¿Cómo se despachó?</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Método de despacho">
          {CARRIER_ORDER.map((carrier) => (
            <Chip key={carrier} isActive={value.carrier === carrier} onClick={() => onChange({ ...value, carrier })}>
              {carrier === 'local' ? 'Entrega en el local' : CARRIER_LABELS[carrier]}
            </Chip>
          ))}
        </div>
      </div>

      {value.carrier === 'otro' && (
        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>¿De qué se trató?</span>
          <input
            value={value.carrierOther}
            onChange={(e) => onChange({ ...value, carrierOther: e.target.value })}
            placeholder="Ej: comisionista, moto, lo retiró un familiar…"
            className={INPUT_CLASS}
          />
        </label>
      )}

      {isCarrier && (
        <>
          <label className={LABEL_CLASS}>
            <span className={LABEL_TEXT_CLASS}>Código de seguimiento (si tiene)</span>
            <input
              value={value.trackingCode}
              onChange={(e) => onChange({ ...value, trackingCode: e.target.value })}
              autoCapitalize="characters"
              className={INPUT_CLASS}
            />
          </label>
          <div>
            <p className={`${LABEL_TEXT_CLASS} mb-1 text-sm`}>El envío</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Pago del envío">
              {(['prepaid', 'on_delivery'] as ShippingPayment[]).map((option) => (
                <Chip
                  key={option}
                  isActive={value.shippingPayment === option}
                  onClick={() => onChange({ ...value, shippingPayment: option })}
                >
                  {SHIPPING_PAYMENT_LABELS[option]}
                </Chip>
              ))}
            </div>
          </div>
        </>
      )}

      <label className={`${LABEL_CLASS} sm:max-w-xs`}>
        <span className={LABEL_TEXT_CLASS}>Fecha del despacho</span>
        <input
          type="date"
          value={value.deliveredAt}
          max={todayAr()}
          onChange={(e) => e.target.value && onChange({ ...value, deliveredAt: e.target.value })}
          className={INPUT_CLASS}
        />
      </label>
    </div>
  );
}

interface DispatchDialogProps {
  order: Order | null;
  onClose: () => void;
  onSaved: (order: Order) => void;
}

export function DispatchDialog({ order, onClose, onSaved }: DispatchDialogProps) {
  return (
    <Modal isOpen={order !== null} onClose={onClose} title={order ? `Despacho realizado · ${order.code}` : 'Despacho realizado'}>
      {order && <DispatchForm key={order.id} order={order} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function DispatchForm({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: (order: Order) => void }) {
  const session = useAdminSession();
  const [draft, setDraft] = useState<DispatchDraft>(() => ({ ...dispatchDraftFrom(order.delivery), deliveredAt: todayAr() }));
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = validateDispatch(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(await dispatchSale(order.id, dispatchPayloadFrom(draft), session.password));
    } catch (err) {
      setError(describeApiError(err, session, 'No se pudo guardar el despacho.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-stone-700">
        <strong className="font-semibold text-stone-900">{order.customer.name}</strong> · {plural(order.itemCount, 'prenda', 'prendas')}
        {order.customer.locality && ` · ${order.customer.locality}`}
      </p>
      <DispatchFields value={draft} onChange={setDraft} />
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Guardando…' : 'Guardar despacho'}
        </Button>
      </div>
    </form>
  );
}
