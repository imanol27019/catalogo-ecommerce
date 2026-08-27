import type { Product } from '../../types/product';
import { ProductCard } from './ProductCard';
import { EmptyState } from './EmptyState';

interface ProductGridProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onClearFilters: () => void;
}

export function ProductGrid({ products, onSelectProduct, onClearFilters }: ProductGridProps) {
  if (products.length === 0) {
    return <EmptyState onClearFilters={onClearFilters} />;
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-10">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onSelect={onSelectProduct} />
      ))}
    </div>
  );
}
