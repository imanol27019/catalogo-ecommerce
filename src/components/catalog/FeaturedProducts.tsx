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
    // `w-full min-w-0`: esta sección es hija de un contenedor flex y, sin esto, no se achica por
    // debajo del ancho de su contenido (min-width:auto), estirando toda la página a lo ancho.
    <section className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <h2 className="font-heading text-2xl font-semibold text-stone-900">Destacados</h2>
        <a href="#catalogo" className="shrink-0 text-sm font-semibold text-brand-700 hover:text-brand-800">
          Ver todo →
        </a>
      </div>

      {/* El scroll va en un contenedor aparte del flex: si van juntos, el ancho lo termina
          fijando el contenido y el carrusel deja de contenerse. */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
        <div className="flex gap-4 pb-2 sm:grid sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
          {featured.map((product) => (
            <div key={product.id} className="w-40 shrink-0 sm:w-auto">
              <ProductCard product={product} onSelect={onSelectProduct} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
