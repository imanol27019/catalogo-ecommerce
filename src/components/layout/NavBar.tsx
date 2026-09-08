import { useEffect, useRef, useState } from 'react';
import { BUSINESS_NAME, BUSINESS_TAGLINE, CATEGORY_LABELS } from '../../config/site.config';
import { useCart } from '../../hooks/useCart';
import { CartIcon, ChevronDownIcon, CloseIcon, HeartIcon } from '../ui/icons';
import { Drawer } from '../ui/Drawer';

interface NavBarProps {
  /** Salen del catálogo real (`useProductFilters`), nunca están escritas a mano. */
  categories: string[];
  activeCategories: string[];
  onSelectCategory: (category: string) => void;
}

const SECCIONES = [
  { href: '#catalogo', label: 'Catálogo' },
  { href: '#temporada', label: 'Temporada' },
  { href: '#como-comprar', label: 'Cómo comprar' },
  { href: '#preguntas', label: 'Preguntas' },
  { href: '#contacto', label: 'Contacto' },
];

export function NavBar({ categories, activeCategories, onSelectCategory }: NavBarProps) {
  const { totals, openDrawer } = useCart();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isCategoriesOpen, setCategoriesOpen] = useState(false);
  const categoriesRef = useRef<HTMLDivElement>(null);

  // El desplegable de categorías se cierra al hacer clic afuera o con Escape, como cualquier menú.
  useEffect(() => {
    if (!isCategoriesOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (categoriesRef.current && !categoriesRef.current.contains(event.target as Node)) setCategoriesOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setCategoriesOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isCategoriesOpen]);

  function pickCategory(category: string) {
    onSelectCategory(category);
    setCategoriesOpen(false);
    setMenuOpen(false);
  }

  return (
    // z-30: el header sticky tapa a los flotantes (z-20) al hacer scroll.
    <header className="sticky top-0 z-30 w-full min-w-0 border-b border-brand-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir el menú"
          aria-expanded={isMenuOpen}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-stone-700 hover:bg-brand-50 lg:hidden"
        >
          <span aria-hidden="true" className="flex flex-col gap-[3px]">
            <span className="block h-0.5 w-5 rounded bg-current" />
            <span className="block h-0.5 w-5 rounded bg-current" />
            <span className="block h-0.5 w-5 rounded bg-current" />
          </span>
        </button>

        {/* El nombre es el logotipo: tamaño grande y con presencia, como en cualquier ecommerce. */}
        <a href="#/" className="flex min-h-11 min-w-0 items-center gap-2 lg:gap-2.5">
          <HeartIcon className="h-5 w-5 shrink-0 text-brand-500 sm:h-6 sm:w-6" />
          <span className="min-w-0">
            <span className="block truncate font-heading text-2xl font-bold leading-none tracking-tight text-stone-900 sm:text-3xl">
              {BUSINESS_NAME}
            </span>
            <span className="mt-1 hidden truncate text-[10px] uppercase tracking-[0.18em] text-stone-600 sm:block">
              {BUSINESS_TAGLINE}
            </span>
          </span>
        </a>

        <nav aria-label="Secciones" className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex">
          {SECCIONES.map((s) => (
            <a
              key={s.href}
              href={s.href}
              className="inline-flex min-h-11 items-center rounded-lg px-3 font-heading text-sm font-medium text-stone-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
            >
              {s.label}
            </a>
          ))}

          {categories.length > 0 && (
            <div ref={categoriesRef} className="relative">
              <button
                type="button"
                onClick={() => setCategoriesOpen((v) => !v)}
                aria-expanded={isCategoriesOpen}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 font-heading text-sm font-medium text-stone-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
              >
                Categorías
                <ChevronDownIcon className={`h-4 w-4 transition-transform ${isCategoriesOpen ? 'rotate-180' : ''}`} />
              </button>
              {isCategoriesOpen && (
                <div className="absolute left-0 top-full z-30 mt-1 min-w-52 rounded-xl border border-brand-100 bg-white p-1.5 shadow-lg">
                  {categories.map((category) => (
                    <a
                      key={category}
                      href="#catalogo"
                      onClick={() => pickCategory(category)}
                      aria-current={activeCategories.includes(category) ? 'true' : undefined}
                      className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors ${
                        activeCategories.includes(category)
                          ? 'bg-brand-600 text-white'
                          : 'text-stone-700 hover:bg-brand-50 hover:text-brand-700'
                      }`}
                    >
                      {CATEGORY_LABELS[category] ?? category}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <button
          type="button"
          onClick={openDrawer}
          className="relative flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-stone-300 bg-white px-3.5 text-sm font-semibold text-stone-800 transition-colors hover:bg-brand-50"
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

      {/* En celular no se amontona: todo entra en un panel, reusando el Drawer del carrito. */}
      <Drawer isOpen={isMenuOpen} onClose={() => setMenuOpen(false)} title="Menú">
        <nav aria-label="Secciones" className="flex flex-col">
          {SECCIONES.map((s) => (
            <a
              key={s.href}
              href={s.href}
              onClick={() => setMenuOpen(false)}
              className="flex min-h-11 items-center border-b border-stone-200 font-heading text-base font-medium text-stone-800"
            >
              {s.label}
            </a>
          ))}
        </nav>

        {categories.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 font-heading text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
              Categorías
            </p>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <a
                  key={category}
                  href="#catalogo"
                  onClick={() => pickCategory(category)}
                  aria-current={activeCategories.includes(category) ? 'true' : undefined}
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors ${
                    activeCategories.includes(category)
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-stone-300 bg-white text-stone-700'
                  }`}
                >
                  {CATEGORY_LABELS[category] ?? category}
                </a>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-stone-600"
        >
          <CloseIcon className="h-4 w-4" />
          Cerrar
        </button>
      </Drawer>
    </header>
  );
}
