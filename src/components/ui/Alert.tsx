import type { ReactNode } from 'react';

type Tone = 'error' | 'warning' | 'success' | 'info';

const TONE_CLASSES: Record<Tone, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-stock-low-soft text-stock-low',
  success: 'border-green-200 bg-stock-in-soft text-stock-in',
  info: 'border-stone-200 bg-stone-50 text-stone-600',
};

interface AlertProps {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  /** Acción de reintento para errores de red, que es de donde vienen casi todos los fallos. */
  onRetry?: () => void;
  className?: string;
}

/** Único formato de aviso del sistema: errores, advertencias y confirmaciones. */
export function Alert({ tone = 'info', title, children, onRetry, className = '' }: AlertProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-3 py-2.5 text-sm ${TONE_CLASSES[tone]} ${className}`}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex min-h-9 items-center rounded-lg border border-current px-3 text-sm font-semibold"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
