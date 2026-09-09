import { useEffect, useState } from 'react';
import { HERO } from '../../config/site.config';
import { resolveImageUrl } from '../../data/apiClient';

/**
 * Tiempos tomados del carrusel de referencia (jamachi.com.ar): la foto cambia cada 2 segundos y
 * el cruce entre una y otra dura 1 segundo. Como el fundido dura la mitad del intervalo, la
 * transición se percibe casi continua en vez de como saltos.
 */
const SLIDE_DURATION_MS = 2000;
const FADE_MS = 1000;

/**
 * Banner de temporada: texto de la marca a un lado y carrusel de fotos al otro.
 *
 * El carrusel es automático y sin controles, igual que el de la referencia. Las fotos son
 * decorativas —no aportan información que no esté en el texto—, así que van fuera del árbol de
 * accesibilidad en vez de anunciarse como un carrusel que no se puede operar.
 *
 * El texto NO va encima de la foto: así se ve a brillo pleno, sin el velo oscuro que antes hacía
 * falta para que el texto blanco se leyera sobre cualquier imagen. En celular se apila —texto
 * arriba, fotos abajo—, y el borde de la foto se difumina hacia el fondo (ver `.hero-fade`).
 */
export function HeroBanner() {
  const images = HERO.images ?? [];
  const total = images.length;
  const hasCarousel = total > 0;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setPaused] = useState(false);

  /**
   * La pausa por mouse solo se engancha en dispositivos que realmente tienen puntero.
   * En una pantalla táctil, tocar el carrusel puede disparar `mouseenter` sin que después llegue
   * nunca un `mouseleave`, y quedaría frenado para siempre en ese celular.
   */
  const puedeHacerHover =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(hover: hover)').matches
      : false;

  useEffect(() => {
    if (total < 2 || isPaused) return;
    // Quien pidió menos movimiento en su sistema no debería ver el carrusel moverse solo.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = setInterval(() => setActiveIndex((i) => (i + 1) % total), SLIDE_DURATION_MS);
    return () => clearInterval(interval);
  }, [total, isPaused]);

  return (
    <section id="temporada" className="w-full min-w-0 scroll-mt-20 bg-brand-50">
      <div
        className={`mx-auto grid max-w-6xl items-center gap-6 px-4 pt-12 sm:px-6 lg:gap-14 lg:py-16 ${
          hasCarousel ? 'pb-0 lg:grid-cols-2' : 'pb-12'
        }`}
      >
        <div
          className={`flex flex-col items-start gap-3 ${
            hasCarousel ? '' : 'mx-auto max-w-2xl items-center text-center'
          }`}
        >
          <span className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
            {HERO.eyebrow}
          </span>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl lg:text-5xl">
            {HERO.heading}
          </h1>
          <p className="text-sm leading-relaxed text-stone-700 sm:text-base">{HERO.subtext}</p>
          <a
            href="#catalogo"
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-600 px-6 font-heading text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            {HERO.ctaLabel}
          </a>
        </div>

        {hasCarousel && (
          <div
            aria-hidden="true"
            onMouseEnter={puedeHacerHover ? () => setPaused(true) : undefined}
            onMouseLeave={puedeHacerHover ? () => setPaused(false) : undefined}
            // Las proporciones siguen a la referencia: casi cuadrada y algo alta en celular,
            // un poco más ancha en escritorio.
            className="hero-fade relative aspect-[9/10] w-full min-w-0 overflow-hidden sm:aspect-[11/10]"
          >
            {images.map((src, index) => (
              <img
                key={`${src}-${index}`}
                src={resolveImageUrl(src)}
                alt=""
                style={{ transitionDuration: `${FADE_MS}ms` }}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity ease-in-out ${
                  index === activeIndex ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
