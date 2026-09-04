import { useId, useState } from 'react';
import { FAQ } from '../../config/site.config';
import { ChevronDownIcon } from '../ui/icons';

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const baseId = useId();

  if (!FAQ || FAQ.length === 0) return null;

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h2 className="mb-6 text-center font-heading text-2xl font-semibold text-stone-900">Preguntas frecuentes</h2>
      <div className="flex flex-col gap-2">
        {FAQ.map((item, index) => {
          const isOpen = openIndex === index;
          const buttonId = `${baseId}-q-${index}`;
          const panelId = `${baseId}-a-${index}`;
          return (
            <div key={item.question} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
              <button
                id={buttonId}
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left font-heading text-sm font-medium text-stone-900"
              >
                {item.question}
                <ChevronDownIcon
                  className={`h-4 w-4 shrink-0 text-brand-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/*
                La respuesta va separada por una línea y sobre un fondo apenas rosado. Antes quedaba
                pegada al texto de la pregunta dentro del mismo recuadro, sin ninguna separación, así
                que al abrirla no se leía como una respuesta sino como si la caja de la pregunta se
                hubiera inflado.
              */}
              {isOpen && (
                <div id={panelId} role="region" aria-labelledby={buttonId} className="animate-reveal">
                  <p className="border-t border-stone-200 bg-brand-50/60 px-4 py-3 text-sm leading-relaxed text-stone-700">
                    {item.answer}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
