import { useState } from 'react';
import { useCart } from '../../hooks/useCart';
import { MIN_ORDER_QTY, MIN_ORDER_TOTAL } from '../../config/site.config';
import { evaluateOrderMinimum } from '../../utils/orderMinimum';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { CartLineItem } from './CartLineItem';
import { CartSummary } from './CartSummary';
import { MinQtyWarning } from './MinQtyWarning';
import { OrderMinimumNotice } from './OrderMinimumNotice';
import { WhatsAppCheckoutModal } from '../checkout/WhatsAppCheckoutModal';
import { WhatsAppIcon } from '../ui/icons';

export function CartDrawer() {
  const {
    items,
    isDrawerOpen,
    closeDrawer,
    updateQty,
    adjustQty,
    removeItem,
    totals,
    validation,
    removedNotice,
    dismissRemovedNotice,
  } = useCart();
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);

  const orderMinimum = evaluateOrderMinimum(totals.itemCount, totals.grandTotal, MIN_ORDER_QTY, MIN_ORDER_TOTAL);

  return (
    <>
      <Drawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        title={`Tu carrito (${totals.itemCount})`}
        footer={
          items.length > 0 ? (
            <div className="flex flex-col gap-3">
              <CartSummary totals={totals} />
              <OrderMinimumNotice status={orderMinimum} />
              <Button onClick={() => setCheckoutOpen(true)} disabled={!orderMinimum.isMet} className="w-full">
                <WhatsAppIcon className="h-4 w-4" />
                Finalizar por WhatsApp
              </Button>
            </div>
          ) : undefined
        }
      >
        {removedNotice && removedNotice.length > 0 && (
          <div className="mb-4 flex items-start justify-between gap-2 rounded-lg border border-stone-200 bg-stone-100 px-3 py-2.5 text-xs text-stone-600">
            <p>Estos productos ya no están disponibles y se quitaron del carrito: {removedNotice.join(', ')}.</p>
            <button
              type="button"
              onClick={dismissRemovedNotice}
              className="shrink-0 font-semibold text-stone-600 hover:text-stone-700"
            >
              OK
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-stone-600">Todavía no agregaste productos.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {validation.allMessages.length > 0 && <MinQtyWarning messages={validation.allMessages} />}
            {items.map((item) => (
              <CartLineItem
                key={item.lineId}
                item={item}
                onSetQty={updateQty}
                onAdjustQty={adjustQty}
                onRemove={removeItem}
              />
            ))}
          </div>
        )}
      </Drawer>

      <WhatsAppCheckoutModal isOpen={isCheckoutOpen} onClose={() => setCheckoutOpen(false)} />
    </>
  );
}
