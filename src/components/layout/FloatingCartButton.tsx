import { useCart } from '../../hooks/useCart';
import { CartIcon } from '../ui/icons';

export function FloatingCartButton() {
  const { totals, openDrawer } = useCart();

  if (totals.itemCount === 0) return null;

  return (
    <button
      type="button"
      onClick={openDrawer}
      // z-20: flotante, misma capa que el contacto de WhatsApp.
      className="fixed bottom-5 right-5 z-20 flex items-center gap-2 rounded-full bg-brand-600 px-4 py-3.5 text-white shadow-lg shadow-brand-900/20 transition-colors hover:bg-brand-700 sm:hidden"
    >
      <CartIcon className="h-5 w-5" />
      <span className="text-sm font-semibold">Ver carrito ({totals.itemCount})</span>
    </button>
  );
}
