import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
}

export function IconButton({ icon, label, className = '', ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // h-11 w-11 = 44px: antes era 36px, por debajo del mínimo táctil recomendado.
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-stone-100 ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
}
