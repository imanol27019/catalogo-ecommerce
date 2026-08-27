import type { Product } from '../../types/product';
import { ProductCard } from './ProductCard';

interface FeaturedProductsProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
}

/** Vidriera de productos destacados/nuevos — se oculta sola si nada está marcado como destacado. */
export function FeaturedProducts({ products, onSelectProduct }: FeaturedProductsProps) {
  const featured = products.filter((p) => p.featured && p.status === 'active').slice(0, 8);
  if (featured.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <h2 className="font-heading text-2xl font-semibold text-stone-900">Destacados</h2>
        <a href="#catalogo" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
          Ver todo →
        </a>
      </div>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {featured.map((product) => (
          <div key={product.id} className="w-40 shrink-0 sm:w-auto">
            <ProductCard product={product} onSelect={onSelectProduct} />
          </div>
        ))}
      </div>
    </section>
  );
}
