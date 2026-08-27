import { useState } from 'react';
import { FAQ } from '../../config/site.config';
import { ChevronDownIcon } from '../ui/icons';

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!FAQ || FAQ.length === 0) return null;

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h2 className="mb-6 text-center font-heading text-2xl font-semibold text-stone-900">Preguntas frecuentes</h2>
      <div className="flex flex-col gap-2">
        {FAQ.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={item.question} className="rounded-lg border border-stone-200 bg-white">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-heading text-sm font-medium text-stone-900"
              >
                {item.question}
                <ChevronDownIcon
                  className={`h-4 w-4 shrink-0 text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {isOpen && <p className="px-4 pb-4 text-sm text-stone-600">{item.answer}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
