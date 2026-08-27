import type { Product } from '../../types/product';
import { findVariant } from '../../utils/stock';

interface SizePickerProps {
  product: Product;
  selectedSize: string;
  selectedColor: string;
  onSelect: (size: string) => void;
}

export function SizePicker({ product, selectedSize, selectedColor, onSelect }: SizePickerProps) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-stone-800">Talle</p>
      <div className="flex flex-wrap gap-2">
        {product.sizes.map((size) => {
          const variant = findVariant(product, size, selectedColor);
          const isOutOfStock = variant?.stockStatus === 'out_of_stock';
          const isActive = size === selectedSize;
          return (
            <button
              key={size}
              type="button"
              disabled={isOutOfStock}
              onClick={() => onSelect(size)}
              title={isOutOfStock ? `Talle ${size}: sin stock en color ${selectedColor}` : `Talle ${size}`}
              className={`min-w-11 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                isOutOfStock
                  ? 'cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400 line-through'
                  : isActive
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'
              }`}
            >
              {size}
            </button>
          );
        })}
      </div>
    </div>
  );
}
