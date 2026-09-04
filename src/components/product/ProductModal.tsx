import { useMemo, useState } from 'react';
import type { Product } from '../../types/product';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { StockBadge } from '../catalog/StockBadge';
import { ProductImageGallery } from './ProductImageGallery';
import { SizePicker } from './SizePicker';
import { ColorSwatchPicker } from './ColorSwatchPicker';
import { QuantityStepper } from './QuantityStepper';
import { PriceDisplay } from './PriceDisplay';
import { CATEGORY_LABELS } from '../../config/site.config';
import { effectiveMinQty, findVariant } from '../../utils/stock';
import { getEffectivePrice, isOnSale } from '../../utils/pricing';
import { useCart } from '../../hooks/useCart';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
}

function pickInitialVariant(product: Product): { size: string; color: string } {
  const inStock = product.variants.find((v) => v.stockStatus !== 'out_of_stock');
  if (inStock) return { size: inStock.size, color: inStock.color };
  return { size: product.sizes[0], color: product.colors[0]?.name ?? '' };
}

export function ProductModal({ product, onClose }: ProductModalProps) {
  if (!product) return null;
  return <ProductModalContent key={product.id} product={product} onClose={onClose} />;
}

function ProductModalContent({ product, onClose }: { product: Product; onClose: () => void }) {
  const { addItem } = useCart();
  const initial = useMemo(() => pickInitialVariant(product), [product]);
  const [selectedSize, setSelectedSize] = useState(initial.size);
  const [selectedColor, setSelectedColor] = useState(initial.color);
  const [qty, setQty] = useState(1);

  const variant = findVariant(product, selectedSize, selectedColor);
  const isOutOfStock = !variant || variant.stockStatus === 'out_of_stock';
  const minQty = variant ? effectiveMinQty(product, variant) : product.minQtyPerVariant;

  function handleSizeChange(size: string) {
    setSelectedSize(size);
    setQty(1);
    const stillValid = findVariant(product, size, selectedColor);
    if (!stillValid || stillValid.stockStatus === 'out_of_stock') {
      const fallback = product.colors.find((c) => {
        const v = findVariant(product, size, c.name);
        return v && v.stockStatus !== 'out_of_stock';
      });
      if (fallback) setSelectedColor(fallback.name);
    }
  }

  function handleColorChange(color: string) {
    setSelectedColor(color);
    setQty(1);
    const stillValid = findVariant(product, selectedSize, color);
    if (!stillValid || stillValid.stockStatus === 'out_of_stock') {
      const fallback = product.sizes.find((s) => {
        const v = findVariant(product, s, color);
        return v && v.stockStatus !== 'out_of_stock';
      });
      if (fallback) setSelectedSize(fallback);
    }
  }

  function handleAddToCart() {
    if (!variant || isOutOfStock) return;
    addItem(product, variant, Math.max(qty, 1));
    onClose();
  }

  return (
    <Modal isOpen title={product.name} onClose={onClose} maxWidthClassName="sm:max-w-2xl">
      <div className="grid gap-5 sm:grid-cols-2">
        <ProductImageGallery images={product.images} alt={product.name} />

        <div className="flex flex-col gap-4">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-stone-600">
              {CATEGORY_LABELS[product.category] ?? product.category}
            </span>
            <h3 className="font-heading text-lg font-semibold text-stone-900">{product.name}</h3>
            <p className="mt-1 text-sm text-stone-600">{product.description}</p>
          </div>

          <PriceDisplay
            unitPrice={getEffectivePrice(product)}
            originalPrice={isOnSale(product) ? product.unitPrice : undefined}
            bulkPricing={product.bulkPricing}
            qty={qty}
          />

          <SizePicker
            product={product}
            selectedSize={selectedSize}
            selectedColor={selectedColor}
            onSelect={handleSizeChange}
          />
          <ColorSwatchPicker
            product={product}
            selectedSize={selectedSize}
            selectedColor={selectedColor}
            onSelect={handleColorChange}
          />

          <div>
            <p className="mb-2 text-sm font-semibold text-stone-800">Cantidad</p>
            <QuantityStepper
              qty={qty}
              min={minQty}
              onIncrement={() => setQty((q) => q + 1)}
              onDecrement={() => setQty((q) => Math.max(1, q - 1))}
              onSetQty={setQty}
              disabled={isOutOfStock}
            />
          </div>

          {product.minQtyPerProduct && (
            <p className="text-xs text-stone-600">
              Este producto tiene un mínimo de {product.minQtyPerProduct} unidades combinando talles/colores.
            </p>
          )}

          {variant && (
            <div className="flex flex-wrap items-center gap-2">
              <StockBadge status={variant.stockStatus} qty={variant.stockQty} long />
              {variant.stockQty > 0 && (
                <span className="text-xs text-stone-600">
                  en talle {variant.size} / {variant.color}
                </span>
              )}
            </div>
          )}

          <Button onClick={handleAddToCart} disabled={isOutOfStock} className="w-full">
            {isOutOfStock ? 'Sin stock en esta combinación' : 'Agregar al carrito'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
