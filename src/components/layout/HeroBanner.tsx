import { useCallback, useEffect, useState } from 'react';
import { HERO } from '../../config/site.config';
import { resolveImageUrl } from '../../data/apiClient';
import { ChevronDownIcon } from '../ui/icons';

const SLIDE_DURATION_MS = 5000;

/**
 * Banner de temporada: carrusel de fotos con el texto de la marca encima.
 *
 * Avanza solo, pero además se puede manejar a mano con las flechas o los puntos, que es lo que
 * espera cualquiera de un carrusel. El avance automático se frena mientras el mouse está encima o
 * algo adentro tiene el foco, para no mover la foto justo cuando alguien la está mirando o
 * navegando con el teclado.
 */
export function HeroBanner() {
  const images = HERO.images ?? [];
  const total = images.length;
  const hasCarousel = total > 0;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setPaused] = useState(false);

  /**
   * La pausa por mouse solo se engancha en dispositivos que realmente tienen puntero.
   * En una pantalla táctil, tocar el banner puede disparar `mouseenter` sin que después llegue
   * nunca un `mouseleave`, y el carrusel quedaría frenado para siempre en ese celular.
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
    <section
      id="temporada"
      aria-roledescription={hasCarousel ? 'carrusel' : undefined}
      aria-label={hasCarousel ? HERO.eyebrow : undefined}
      onMouseEnter={puedeHacerHover ? () => setPaused(true) : undefined}
      onMouseLeave={puedeHacerHover ? () => setPaused(false) : undefined}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className={`relative flex min-h-[380px] scroll-mt-20 items-center justify-center overflow-hidden px-6 py-16 text-center text-white sm:min-h-[460px] ${
        hasCarousel ? '' : 'bg-gradient-to-br from-brand-700 via-brand-600 to-brand-400'
      }`}
    >
      {hasCarousel && (
        <div className="absolute inset-0">
          {images.map((src, index) => (
            <img
              key={`${src}-${index}`}
              src={resolveImageUrl(src)}
              alt=""
              aria-hidden="true"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                index === activeIndex ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
          {/*
            El velo va al 55% y no al 45%: el texto es blanco y la foto la elige el negocio, así
            que puede ser clara. Sobre una foto blanca, un velo del 45% deja el contraste en 3.36
            (hace falta 4.5); con 55% queda en 4.74 en el peor caso.
          */}
          <div className="absolute inset-0 bg-stone-900/55" />
        </div>
      )}

      <div className="relative z-10 flex max-w-xl flex-col items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">{HERO.eyebrow}</span>
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">{HERO.heading}</h1>
        <p className="text-sm text-white/90 sm:text-base">{HERO.subtext}</p>
        <a
          href="#catalogo"
          className="mt-2 inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-5 text-sm font-semibold text-brand-700 transition-colors hover:bg-stone-100"
        >
          {HERO.ctaLabel}
        </a>
      </div>

      {total > 1 && (
        <>
          {/* Los chevrones son verticales: se rotan para que apunten a los costados. */}
          <CarouselArrow side="left" label="Foto anterior" onClick={prev} />
          <CarouselArrow side="right" label="Foto siguiente" onClick={next} />

          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1">
            {images.map((src, index) => (
              <button
                key={`punto-${src}-${index}`}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Ver la foto ${index + 1} de ${total}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                // El área táctil es de 44px aunque el punto sea chico: el punto va adentro.
                className="flex h-11 w-6 items-center justify-center"
              >
                <span
                  aria-hidden="true"
                  className={`block h-1.5 rounded-full transition-all ${
                    index === activeIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/55'
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function CarouselArrow({ side, label, onClick }: { side: 'left' | 'right'; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-stone-900/45 text-white backdrop-blur transition-colors hover:bg-stone-900/70 ${
        side === 'left' ? 'left-2 sm:left-4' : 'right-2 sm:right-4'
      }`}
    >
      <ChevronDownIcon className={`h-5 w-5 ${side === 'left' ? 'rotate-90' : '-rotate-90'}`} />
    </button>
  );
}
