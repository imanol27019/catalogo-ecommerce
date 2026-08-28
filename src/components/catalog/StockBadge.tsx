import type { StockStatus } from '../../types/product';
import { Badge } from '../ui/Badge';

const TONE_BY_STATUS: Record<StockStatus, 'stock-in' | 'stock-low' | 'stock-out'> = {
  in_stock: 'stock-in',
  low_stock: 'stock-low',
  out_of_stock: 'stock-out',
};

interface StockBadgeProps {
  status: StockStatus;
  /** Unidades reales. Se muestran en vez de una etiqueta genérica: al mayorista le sirve el número. */
  qty: number;
  /** Texto largo ("12 unidades") para el detalle; corto ("12 u.") para la grilla. */
  long?: boolean;
}

export function StockBadge({ status, qty, long = false }: StockBadgeProps) {
  const label =
    qty <= 0 ? 'Sin stock' : long ? `${qty} ${qty === 1 ? 'unidad' : 'unidades'}` : `${qty} u.`;

  return <Badge tone={TONE_BY_STATUS[status]}>{label}</Badge>;
}
