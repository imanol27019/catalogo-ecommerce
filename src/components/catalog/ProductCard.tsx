import type { Product } from '../../types/product';
import { CATEGORY_LABELS } from '../../config/site.config';
import { formatCurrency } from '../../utils/format';
import { getEffectivePrice, isOnSale } from '../../utils/pricing';
import { getProductAggregateStock, getProductTotalStock } from '../../utils/stock';
import { StockBadge } from './StockBadge';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export function ProductCard({ product, onSelect }: ProductCardProps) {
  const stock = getProductAggregateStock(product);
  const totalUnits = getProductTotalStock(product);
  const categoryLabel = CATEGORY_LABELS[product.category] ?? product.category;
  const onSale = isOnSale(product);
  const price = getEffectivePrice(product);

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className="group flex flex-col overflow-hidden rounded-xl bg-white text-center shadow-sm ring-1 ring-stone-200 transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-stone-100">
        <img
          src={product.images[0]}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
        <div className="absolute left-2 top-2">
          <StockBadge status={stock} qty={totalUnits} />
        </div>
        {onSale && (
          <span className="absolute right-2 top-2 rounded-full bg-stone-900 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
            Oferta
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col items-center gap-1 p-3">
        <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">{categoryLabel}</span>
        <h3 className="line-clamp-2 font-heading text-sm font-medium text-stone-900">{product.name}</h3>
        <div className="mt-1 flex items-baseline gap-2">
          {onSale && <span className="text-xs text-stone-400 line-through">{formatCurrency(product.unitPrice)}</span>}
          <span className="font-heading text-lg font-semibold text-brand-600">{formatCurrency(price)}</span>
        </div>
        <span className="mt-2 w-full rounded-lg bg-brand-600 py-2 text-xs font-semibold text-white transition-colors group-hover:bg-brand-700">
          Ver opciones
        </span>
      </div>
    </button>
  );
}
