import { useEffect, useState } from 'react';
import { HERO } from '../../config/site.config';

const SLIDE_DURATION_MS = 5000;

export function HeroBanner() {
  const images = HERO.images ?? [];
  const hasGallery = images.length > 0;
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const interval = setInterval(() => {
      setActiveIndex((i) => (i + 1) % images.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <section
      className={`relative flex min-h-[320px] items-center justify-center overflow-hidden px-6 py-16 text-center text-white sm:min-h-[420px] ${
        hasGallery ? '' : 'bg-gradient-to-br from-brand-700 via-brand-600 to-brand-400'
      }`}
    >
      {hasGallery && (
        <div className="absolute inset-0">
          {images.map((src, index) => (
            <img
              key={src}
              src={src}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
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
    </section>
  );
}
