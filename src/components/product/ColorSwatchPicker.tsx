import type { Product } from '../../types/product';
import { findVariant } from '../../utils/stock';

interface ColorSwatchPickerProps {
  product: Product;
  selectedSize: string;
  selectedColor: string;
  onSelect: (color: string) => void;
}

export function ColorSwatchPicker({ product, selectedSize, selectedColor, onSelect }: ColorSwatchPickerProps) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-stone-800">Color</p>
      <div className="flex flex-wrap gap-3">
        {product.colors.map((color) => {
          const variant = findVariant(product, selectedSize, color.name);
          const isOutOfStock = variant?.stockStatus === 'out_of_stock';
          const isActive = color.name === selectedColor;
          return (
            <div key={color.name} className="flex w-10 flex-col items-center gap-1">
              <button
                type="button"
                disabled={isOutOfStock}
                onClick={() => onSelect(color.name)}
                title={
                  isOutOfStock
                    ? `${color.name}: sin stock en talle ${selectedSize}`
                    : `${color.name}: ${variant?.stockQty ?? 0} u. en talle ${selectedSize}`
                }
                aria-label={color.name}
                aria-pressed={isActive}
                className={`relative h-10 w-10 rounded-full ring-1 ring-inset ring-black/10 transition-transform ${
                  isOutOfStock
                    ? 'cursor-not-allowed opacity-35'
                    : isActive
                      ? 'scale-110 outline outline-2 outline-offset-2 outline-brand-600'
                      : ''
                }`}
                style={{ backgroundColor: color.hex }}
              >
                {isOutOfStock && (
                  <span className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full">
                    <span className="h-[140%] w-px rotate-45 bg-stone-500" />
                  </span>
                )}
              </button>
              <span className="text-[10px] text-stone-400">{isOutOfStock ? '—' : `${variant?.stockQty ?? 0} u.`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
