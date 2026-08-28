import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-stone-200 disabled:text-stone-500',
  secondary:
    'border border-stone-300 bg-white text-stone-900 hover:bg-stone-50 disabled:bg-stone-100 disabled:text-stone-500',
  ghost: 'bg-transparent text-stone-700 hover:bg-stone-100 disabled:text-stone-500',
  danger: 'border border-stone-300 bg-white text-red-700 hover:bg-red-50 disabled:text-stone-500',
};

// min-h-11 = 44px, el mínimo recomendado para tocar con el dedo sin errarle. Hay un solo tamaño
// a propósito: una variante más chica quedaría por debajo de ese piso.
export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-heading text-sm font-semibold transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
