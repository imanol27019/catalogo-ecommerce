import { BUSINESS_NAME, BUSINESS_TAGLINE } from '../../config/site.config';
import { useCart } from '../../hooks/useCart';
import { CartIcon, HeartIcon } from '../ui/icons';

export function Header() {
  const { totals, openDrawer } = useCart();

  return (
    // z-30: el header sticky tapa a los flotantes (z-20) al hacer scroll.
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-4 sm:px-6">
        <div />
        <a href="#/" className="inline-flex min-h-11 min-w-0 flex-col justify-center text-center">
          <p className="flex items-center justify-center gap-1.5 truncate font-heading text-xl font-semibold tracking-tight text-stone-900">
            <HeartIcon className="h-4 w-4 shrink-0 text-brand-500" />
            {BUSINESS_NAME}
          </p>
          <p className="truncate text-[11px] uppercase tracking-widest text-stone-600">{BUSINESS_TAGLINE}</p>
        </a>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={openDrawer}
            className="relative flex min-h-11 items-center gap-2 rounded-full border border-stone-300 bg-white px-3.5 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-50"
          >
            <CartIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Carrito</span>
            {totals.itemCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">
                {totals.itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
