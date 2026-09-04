import type { BulkPriceTier } from '../../types/product';
import { computeLineUnitPrice, nextBulkTier } from '../../utils/pricing';
import { formatCurrency } from '../../utils/format';

interface PriceDisplayProps {
  /** Precio base sobre el que se calcula el descuento por bulto (ya con oferta aplicada si hay). */
  unitPrice: number;
  /** Precio de lista, se muestra tachado si termina siendo distinto del precio final. */
  originalPrice?: number;
  bulkPricing?: BulkPriceTier[];
  qty: number;
}

export function PriceDisplay({ unitPrice, originalPrice, bulkPricing, qty }: PriceDisplayProps) {
  const effectiveUnitPrice = computeLineUnitPrice({ unitPrice, bulkPricing, qty });
  const next = nextBulkTier({ unitPrice, bulkPricing, qty });
  const referencePrice = originalPrice ?? unitPrice;
  const showCrossedOut = referencePrice !== effectiveUnitPrice;

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-heading text-2xl font-semibold text-brand-600">{formatCurrency(effectiveUnitPrice)}</span>
        <span className="text-sm text-stone-600">/ unidad</span>
        {showCrossedOut && <span className="text-sm text-stone-600 line-through">{formatCurrency(referencePrice)}</span>}
      </div>
      {next && (
        <p className="mt-1 text-xs text-brand-700">
          Llevando {next.minQty} o más unidades (mismo talle/color), el precio baja a {formatCurrency(next.price)} c/u.
        </p>
      )}
      <p className="mt-1 text-sm font-semibold text-stone-700">Subtotal: {formatCurrency(effectiveUnitPrice * qty)}</p>
    </div>
  );
}
