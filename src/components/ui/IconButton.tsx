import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
}

export function IconButton({ icon, label, className = '', ...props }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
}
