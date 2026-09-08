import { LOOKBOOK } from '../../config/site.config';
import { resolveImageUrl } from '../../data/apiClient';

/**
 * Galería editorial de temporada: fotos de campaña, sin precios ni botones.
 *
 * El mosaico se arma con `grid-auto-flow: dense` y una regla simple: la primera foto ocupa el
 * doble de ancho y de alto, y de ahí en más cada tercera vuelve a destacarse. Así el ritmo visual
 * se sostiene con 3, 5 u 8 fotos sin tener que definir un layout por cada cantidad, y con una sola
 * foto se ve una imagen grande y limpia en vez de un hueco.
 */
export function LookbookGallery() {
  const images = LOOKBOOK?.images ?? [];
  if (images.length === 0) return null;

  const soloUna = images.length === 1;

  return (
    <section id="temporada" className="w-full min-w-0 scroll-mt-24 bg-white py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-7 max-w-xl">
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Lookbook</p>
          <h2 className="mt-1.5 font-heading text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            {LOOKBOOK.title}
          </h2>
          {LOOKBOOK.subtitle && <p className="mt-2 text-sm leading-relaxed text-stone-600">{LOOKBOOK.subtitle}</p>}
        </div>

        <div
          className={
            soloUna
              ? 'overflow-hidden rounded-2xl'
              : 'grid auto-rows-[130px] grid-flow-dense grid-cols-2 gap-3 sm:auto-rows-[180px] sm:grid-cols-3 lg:grid-cols-4'
          }
        >
          {images.map((src, index) => {
            // La primera y luego cada tercera ocupan el doble: crea el ritmo del mosaico.
            const destacada = !soloUna && index % 3 === 0;
            return (
              <figure
                key={`${src}-${index}`}
                className={`group relative overflow-hidden rounded-2xl bg-brand-100 ${
                  soloUna ? 'aspect-[16/9]' : destacada ? 'col-span-2 row-span-2' : ''
                }`}
              >
                <img
                  src={resolveImageUrl(src)}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Velo suave abajo: unifica fotos de luces distintas y le da terminación de marca. */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-plum-900/25 to-transparent" />
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
