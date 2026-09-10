import { useId, useLayoutEffect, useRef, useState } from 'react';
import { FAQ } from '../../config/site.config';
import type { FaqItem } from '../../types/settings';
import { ChevronDownIcon } from '../ui/icons';

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const baseId = useId();

  if (!FAQ || FAQ.length === 0) return null;

  return (
    <section id="preguntas" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-14 sm:px-6">
      <div className="mb-7 text-center">
        <p className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
          ¿Te quedó alguna duda?
        </p>
        <h2 className="mt-1.5 font-heading text-3xl font-semibold tracking-tight text-stone-900">
          Preguntas frecuentes
        </h2>
      </div>

      <div className="flex flex-col gap-2.5">
        {FAQ.map((item, index) => (
          <FaqRow
            key={item.question}
            item={item}
            isOpen={openIndex === index}
            onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            buttonId={`${baseId}-q-${index}`}
            panelId={`${baseId}-a-${index}`}
          />
        ))}
      </div>
    </section>
  );
}

function FaqRow({
  item,
  isOpen,
  onToggle,
  buttonId,
  panelId,
}: {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
  buttonId: string;
  panelId: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  /**
   * La altura del panel se anima entre 0 y la que ocupa la respuesta, y para eso hay que medirla:
   * `height` no puede transicionar hacia `auto`. Antes esto no se animaba y la caja saltaba de
   * golpe a su tamaño final.
   *
   * Se mide con un ResizeObserver y no una sola vez, porque el alto cambia cuando el texto se
   * reacomoda —al rotar el celular o al cambiar el ancho de la ventana— y una medición vieja
   * dejaría la respuesta cortada o con un hueco debajo.
   */
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    setContentHeight(el.offsetHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setContentHeight(entry.target.scrollHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-white transition-colors ${
        isOpen ? 'border-brand-200' : 'border-stone-200'
      }`}
    >
      <button
        id={buttonId}
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className={`flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3.5 text-left font-heading text-sm font-medium transition-colors sm:text-base ${
          isOpen ? 'text-brand-700' : 'text-stone-900 hover:bg-brand-50/60'
        }`}
      >
        {item.question}
        <span
          aria-hidden="true"
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
            isOpen ? 'rotate-180 bg-brand-600 text-white' : 'bg-brand-50 text-brand-600'
          }`}
        >
          <ChevronDownIcon className="h-4 w-4" />
        </span>
      </button>

      {/*
        El panel queda siempre montado para poder medirlo, y se colapsa con altura 0. `inert` lo
        saca del tabulador y del lector de pantalla mientras está cerrado; `hidden` no serviría
        porque aplica display:none y cortaría la animación.
      */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        inert={!isOpen}
        style={{ height: isOpen ? contentHeight : 0 }}
        className="overflow-hidden transition-[height] duration-300 ease-out"
      >
        <div ref={contentRef}>
          <p className="border-t border-brand-100 bg-brand-50/50 px-4 py-3.5 text-sm leading-relaxed text-stone-700">
            {item.answer}
          </p>
        </div>
      </div>
    </div>
  );
}
