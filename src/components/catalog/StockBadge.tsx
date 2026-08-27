import type { StockStatus } from '../../types/product';
import { STOCK_LABELS } from '../../utils/stock';
import { Badge } from '../ui/Badge';

const TONE_BY_STATUS: Record<StockStatus, 'stock-in' | 'stock-low' | 'stock-out'> = {
  in_stock: 'stock-in',
  low_stock: 'stock-low',
  out_of_stock: 'stock-out',
};

export function StockBadge({ status }: { status: StockStatus }) {
  return <Badge tone={TONE_BY_STATUS[status]}>{STOCK_LABELS[status]}</Badge>;
}
