import { useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { ShippingMethodPicker } from './ShippingMethodPicker';
import { OrderPreview } from './OrderPreview';
import { useCart } from '../../hooks/useCart';
import { buildOrderMessage, buildWhatsAppUrl } from '../../utils/whatsapp';
import { evaluateOrderMinimum } from '../../utils/orderMinimum';
import { MIN_ORDER_QTY, MIN_ORDER_TOTAL, SHIPPING_METHODS } from '../../config/site.config';
import type { OrderFormData } from '../../types/order';
import { createOrder } from '../../data/orders';
import { WhatsAppIcon } from '../ui/icons';
import { INPUT_CLASS, TEXTAREA_CLASS } from '../ui/formStyles';
import { OrderMinimumNotice } from '../cart/OrderMinimumNotice';

interface WhatsAppCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_FORM: OrderFormData = {
  contactName: '',
  locality: '',
  shippingMethodId: SHIPPING_METHODS[0]?.id ?? '',
  comment: '',
};

export function WhatsAppCheckoutModal({ isOpen, onClose }: WhatsAppCheckoutModalProps) {
  const { items, totals, validation } = useCart();
  const [form, setForm] = useState<OrderFormData>(EMPTY_FORM);

  const orderMinimum = evaluateOrderMinimum(totals.itemCount, totals.grandTotal, MIN_ORDER_QTY, MIN_ORDER_TOTAL);
  const isFormValid =
    orderMinimum.isMet &&
    form.contactName.trim().length > 0 &&
    form.locality.trim().length > 0 &&
    form.shippingMethodId.length > 0;

  const whatsappUrl = useMemo(
    () => buildWhatsAppUrl(buildOrderMessage(form, items, totals, validation)),
    [form, items, totals, validation],
  );

  /**
   * Deja el pedido registrado en el panel como "pendiente" antes de saltar a WhatsApp.
   * A propósito NO se espera la respuesta ni se bloquea el link: abrir WhatsApp es lo importante,
   * y si el registro falla la venta igual se cierra por chat como siempre.
   */
  function registerPendingOrder() {
    const shippingMethodLabel =
      SHIPPING_METHODS.find((m) => m.id === form.shippingMethodId)?.label ?? form.shippingMethodId;
    createOrder({
      customer: {
        name: form.contactName.trim(),
        locality: form.locality.trim(),
        shippingMethodLabel,
        ...(form.comment?.trim() ? { comment: form.comment.trim() } : {}),
      },
      lines: items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        qty: item.qty,
      })),
    }).catch((err) => {
      console.warn('No se pudo registrar el pedido en el panel (el envío por WhatsApp sigue igual).', err);
    });
  }

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Finalizar por WhatsApp">
      <div className="flex flex-col gap-4">
        <OrderPreview items={items} totals={totals} />
        <OrderMinimumNotice status={orderMinimum} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-stone-800">Nombre / nombre del local *</span>
          <input
            type="text"
            required
            value={form.contactName}
            onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
            placeholder="Ej: María / Local Rodríguez"
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-stone-800">Localidad / zona *</span>
          <input
            type="text"
            required
            value={form.locality}
            onChange={(e) => setForm((f) => ({ ...f, locality: e.target.value }))}
            placeholder="Ej: Morón, Buenos Aires"
            className={INPUT_CLASS}
          />
        </label>

        <ShippingMethodPicker
          selectedId={form.shippingMethodId}
          onChange={(shippingMethodId) => setForm((f) => ({ ...f, shippingMethodId }))}
        />

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-stone-800">Comentario (opcional)</span>
          <textarea
            value={form.comment}
            onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
            rows={3}
            placeholder="Alguna aclaración sobre el pedido..."
            className={TEXTAREA_CLASS}
          />
        </label>

        {isFormValid ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              registerPendingOrder();
              onClose();
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 font-heading text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <WhatsAppIcon className="h-4 w-4" />
            Finalizar por WhatsApp
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-stone-300 px-4 py-3 text-sm font-semibold text-stone-500"
          >
            <WhatsAppIcon className="h-4 w-4" />
            {orderMinimum.isMet ? 'Completá nombre y localidad' : 'Todavía no llegás al mínimo de compra'}
          </button>
        )}
      </div>
    </Modal>
  );
}
