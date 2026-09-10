import { useMemo } from 'react';
import type { Product } from '../../types/product';
import { CATEGORY_LABELS } from '../../config/site.config';
import { resolveImageUrl } from '../../data/apiClient';

interface CategoryTilesProps {
  products: Product[];
  onSelectCategory: (category: string) => void;
}

/**
 * Tira de categorías debajo del banner: cada baldosa es una foto con el nombre de la categoría y
 * lleva al catálogo ya filtrado.
 *
 * Es lo que le faltaba a la portada: hasta acá las fotos del banner eran decoración y no había
 * forma de pasar de "me gustó esto" a "mostrame estas prendas".
 *
 * La foto sale del primer producto de cada categoría que tenga imagen, así que no hay que subir
 * nada aparte ni queda desactualizada: si cambia el catálogo, cambia sola.
 */
export function CategoryTiles({ products, onSelectCategory }: CategoryTilesProps) {
  const categorias = useMemo(() => {
    const porCategoria = new Map<string, { imagen: string; cantidad: number }>();
    for (const product of products) {
      if (product.status !== 'active') continue;
      const actual = porCategoria.get(product.category);
      const imagen = actual?.imagen || product.images[0] || '';
      porCategoria.set(product.category, { imagen, cantidad: (actual?.cantidad ?? 0) + 1 });
    }
    return [...porCategoria.entries()].map(([id, datos]) => ({ id, ...datos }));
  }, [products]);

  if (categorias.length === 0) return null;

  return (
    <section aria-label="Categorías" className="w-full min-w-0 bg-brand-50 pb-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div
          className={`grid gap-3 sm:gap-4 ${
            // Con pocas categorías conviene que las baldosas sean grandes en vez de dejar huecos.
            categorias.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'
          }`}
        >
          {categorias.map((categoria) => (
            <a
              key={categoria.id}
              href="#catalogo"
              onClick={() => onSelectCategory(categoria.id)}
              className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-brand-100 sm:aspect-[3/4]"
            >
              {categoria.imagen && (
                <img
                  src={resolveImageUrl(categoria.imagen)}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              )}
              {/*
                Velo de abajo hacia arriba: el nombre va sobre la foto y tiene que leerse sobre
                cualquier imagen, clara u oscura. El degradé deja la parte de arriba limpia.
              */}
              <span className="absolute inset-0 bg-gradient-to-t from-plum-900/85 via-plum-900/25 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                <span className="block font-heading text-base font-semibold tracking-tight text-white sm:text-lg">
                  {CATEGORY_LABELS[categoria.id] ?? categoria.id}
                </span>
                <span className="mt-0.5 block text-xs text-white/85">
                  {categoria.cantidad} {categoria.cantidad === 1 ? 'modelo' : 'modelos'}
                </span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
