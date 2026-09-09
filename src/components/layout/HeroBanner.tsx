import { useCallback, useEffect, useState } from 'react';
import { HERO } from '../../config/site.config';
import { resolveImageUrl } from '../../data/apiClient';
import { ChevronDownIcon } from '../ui/icons';

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
 * El texto NO va encima de la foto, y eso es a propósito: así la foto se ve a brillo pleno, sin el
 * velo oscuro que antes hacía falta para que el texto blanco se leyera sobre cualquier imagen.
 * En celular se apila —texto arriba, fotos abajo—, igual que en la página de referencia.
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

  const goTo = useCallback((index: number) => setActiveIndex(((index % total) + total) % total), [total]);
  const next = useCallback(() => setActiveIndex((i) => (i + 1) % total), [total]);
  const prev = useCallback(() => setActiveIndex((i) => (i - 1 + total) % total), [total]);

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
        className={`mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:px-6 lg:gap-14 lg:py-16 ${
          hasCarousel ? 'lg:grid-cols-2' : ''
        }`}
      >
        <div className={`flex flex-col items-start gap-3 ${hasCarousel ? '' : 'mx-auto max-w-2xl items-center text-center'}`}>
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
            aria-roledescription="carrusel"
            aria-label={HERO.eyebrow}
            onMouseEnter={puedeHacerHover ? () => setPaused(true) : undefined}
            onMouseLeave={puedeHacerHover ? () => setPaused(false) : undefined}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
            // Las proporciones siguen a la referencia: casi cuadrada y algo alta en celular,
            // un poco más ancha en escritorio.
            className="relative aspect-[9/10] w-full min-w-0 overflow-hidden rounded-2xl bg-brand-100 sm:aspect-[11/10]"
          >
            {images.map((src, index) => (
              <img
                key={`${src}-${index}`}
                src={resolveImageUrl(src)}
                alt=""
                aria-hidden="true"
                style={{ transitionDuration: `${FADE_MS}ms` }}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity ease-in-out ${
                  index === activeIndex ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}

            {total > 1 && (
              <>
                {/* Los chevrones son verticales: se rotan para que apunten a los costados. */}
                <CarouselArrow side="left" label="Foto anterior" onClick={prev} />
                <CarouselArrow side="right" label="Foto siguiente" onClick={next} />

                {/*
                  Los puntos van sobre una píldora oscura. Ahora la foto se ve a brillo pleno, así
                  que unos puntos blancos sueltos se perderían sobre una imagen clara.
                */}
                <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center rounded-full bg-stone-900/55 px-1.5 backdrop-blur">
                  {images.map((src, index) => (
                    <button
                      key={`punto-${src}-${index}`}
                      type="button"
                      onClick={() => goTo(index)}
                      aria-label={`Ver la foto ${index + 1} de ${total}`}
                      aria-current={index === activeIndex ? 'true' : undefined}
                      // El área táctil es de 44px aunque el punto se dibuje chico.
                      className="flex h-11 w-6 items-center justify-center"
                    >
                      <span
                        aria-hidden="true"
                        className={`block h-1.5 rounded-full transition-all ${
                          index === activeIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/60'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function CarouselArrow({ side, label, onClick }: { side: 'left' | 'right'; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-stone-900/55 text-white backdrop-blur transition-colors hover:bg-stone-900/75 ${
        side === 'left' ? 'left-2' : 'right-2'
      }`}
    >
      <ChevronDownIcon className={`h-5 w-5 ${side === 'left' ? 'rotate-90' : '-rotate-90'}`} />
    </button>
  );
}
