import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Carrier, Order, ShippingPayment } from '../../types/order';
import type { MessageTemplates } from '../../types/sales';
import { BUSINESS_NAME } from '../../config/site.config';
import { dispatchSale } from '../../data/orders';
import { buildWhatsAppChatUrl, CARRIER_LABELS, SHIPPING_PAYMENT_LABELS, todayAr } from '../../utils/sales';
import { buildCustomerMessage, canSendDispatchNotice } from '../../utils/messages';
import { dispatchDraftFrom, dispatchPayloadFrom, validateDispatch, type DispatchDraft } from '../../utils/dispatch';
import { plural } from '../../utils/format';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Alert } from '../ui/Alert';
import { WhatsAppIcon } from '../ui/icons';
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
  /** WhatsApp de la clienta, para avisarle que su pedido salió. */
  whatsapp?: string;
  templates: Partial<MessageTemplates>;
  onClose: () => void;
  onSaved: (order: Order) => void;
}

export function DispatchDialog({ order, whatsapp, templates, onClose, onSaved }: DispatchDialogProps) {
  return (
    <Modal isOpen={order !== null} onClose={onClose} title={order ? `Despacho realizado · ${order.code}` : 'Despacho realizado'}>
      {order && (
        <DispatchForm key={order.id} order={order} whatsapp={whatsapp} templates={templates} onClose={onClose} onSaved={onSaved} />
      )}
    </Modal>
  );
}

function DispatchForm({
  order,
  whatsapp,
  templates,
  onClose,
  onSaved,
}: Omit<DispatchDialogProps, 'order'> & { order: Order }) {
  const session = useAdminSession();
  const [draft, setDraft] = useState<DispatchDraft>(() => ({ ...dispatchDraftFrom(order.delivery), deliveredAt: todayAr() }));
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Una vez guardado, la ventana pasa a ofrecer el aviso para la clienta. */
  const [saved, setSaved] = useState<Order | null>(null);

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
      const updated = await dispatchSale(order.id, dispatchPayloadFrom(draft), session.password);
      onSaved(updated);
      // Si se entregó en mano en el local no hay nada que avisar: se cierra directamente.
      if (canSendDispatchNotice(updated)) setSaved(updated);
      else onClose();
    } catch (err) {
      setError(describeApiError(err, session, 'No se pudo guardar el despacho.'));
    } finally {
      setSaving(false);
    }
  }

  if (saved) return <DispatchNotice order={saved} whatsapp={whatsapp} templates={templates} onClose={onClose} />;

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

/**
 * Después de guardar el despacho: el mensajito para la clienta, armado con la plantilla de
 * "Aviso de despacho" (incluye el seguimiento si hay). Se manda por WhatsApp o se copia, por si
 * se le escribe por otro lado.
 */
function DispatchNotice({
  order,
  whatsapp,
  templates,
  onClose,
}: {
  order: Order;
  whatsapp?: string;
  templates: Partial<MessageTemplates>;
  onClose: () => void;
}) {
  const message = buildCustomerMessage('dispatch', order, BUSINESS_NAME, templates);
  const url = buildWhatsAppChatUrl(whatsapp, message);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert tone="success" title="Despacho guardado">
        ¿Le avisás a {order.customer.name.split(' ')[0]} que su pedido ya salió?
      </Alert>
      <pre className="whitespace-pre-wrap rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 font-sans text-sm text-stone-800">
        {message}
      </pre>
      {!url && (
        <p className="text-xs text-stone-600">
          La clienta no tiene WhatsApp cargado: podés copiar el mensaje, o cargarle el número en su ficha.
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Ahora no
        </Button>
        <Button type="button" variant="secondary" onClick={() => void copy()}>
          {copied ? '¡Copiado!' : 'Copiar mensaje'}
        </Button>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-whatsapp-dark px-4 font-heading text-sm font-semibold text-white underline-offset-2 hover:underline"
          >
            <WhatsAppIcon className="h-4 w-4" />
            Avisarle por WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
