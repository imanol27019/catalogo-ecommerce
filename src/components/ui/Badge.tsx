import type { HTMLAttributes } from 'react';

type Tone = 'neutral' | 'brand' | 'stock-in' | 'stock-low' | 'stock-out';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-stone-100 text-stone-700',
  brand: 'bg-brand-50 text-brand-700',
  'stock-in': 'bg-stock-in-soft text-stock-in',
  'stock-low': 'bg-stock-low-soft text-stock-low',
  'stock-out': 'bg-stock-out-soft text-stock-out',
};

export function Badge({ tone = 'neutral', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[tone]} ${className}`}
      {...props}
    />
  );
}
