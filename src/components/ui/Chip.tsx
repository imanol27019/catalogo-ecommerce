import type { ButtonHTMLAttributes } from 'react';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean;
}

/**
 * Píldora seleccionable (filtros por categoría, talle, disponibilidad, estado de venta).
 * Existía repetida a mano en seis lugares con radios y padding distintos; esta es la única versión.
 * min-h-11 = 44px para que se pueda tocar cómodo desde el celular.
 */
export function Chip({ isActive = false, className = '', ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors ${
        isActive
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-50'
      } ${className}`}
      {...props}
    />
  );
}
