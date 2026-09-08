import type { BulkPriceTier } from '../../types/product';
import { nextBulkTier, sortBulkTiers, unitPriceForQty } from '../../utils/pricing';
import { formatCurrency } from '../../utils/format';

interface PriceDisplayProps {
  /** Precio base sobre el que se calcula el descuento por bulto (ya con oferta aplicada si hay). */
  unitPrice: number;
  /** Precio de lista, se muestra tachado si termina siendo distinto del precio final. */
  originalPrice?: number;
  bulkPricing?: BulkPriceTier[];
  /**
   * Unidades TOTALES de este producto: las que ya están en el carrito más las que se están
   * eligiendo ahora. El escalón se resuelve sobre este número, no sobre una sola línea.
   */
  productQty: number;
  /** Unidades que se están agregando, para el subtotal de esta operación. */
  qty: number;
}

export function PriceDisplay({ unitPrice, originalPrice, bulkPricing, productQty, qty }: PriceDisplayProps) {
  const pricing = { unitPrice, bulkPricing };
  const effectiveUnitPrice = unitPriceForQty(pricing, productQty);
  const next = nextBulkTier(pricing, productQty);
  const escalones = sortBulkTiers(bulkPricing);
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
          Llevando {next.minQty} o más unidades de este modelo (sumando talles y colores), el precio baja a{' '}
          {formatCurrency(next.price)} c/u.
        </p>
      )}

      {/* La escalera completa: que se vea de una cuánto conviene llevar. */}
      {escalones.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {escalones.map((tier) => {
            const activo = productQty >= tier.minQty && effectiveUnitPrice === tier.price;
            return (
              <li
                key={tier.minQty}
                className={`rounded-lg border px-2 py-1 text-xs ${
                  activo ? 'border-brand-600 bg-brand-50 font-semibold text-brand-700' : 'border-stone-200 text-stone-600'
                }`}
              >
                {tier.minQty}+ u. · {formatCurrency(tier.price)}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-1 text-sm font-semibold text-stone-700">Subtotal: {formatCurrency(effectiveUnitPrice * qty)}</p>
    </div>
  );
}
