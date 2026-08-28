/**
 * Estilos compartidos de formulario. Antes convivían cuatro escalas de padding casi iguales
 * (px-3 py-2 / px-3 py-2.5 / px-2.5 py-1.5 / px-2 py-1.5) y varios campos borraban el foco con
 * `focus:outline-none` sin poner nada en su lugar. Acá hay una sola versión; el indicador de foco
 * lo aporta la regla global `:focus-visible` de index.css.
 */

/** Campo de tamaño normal. min-h-11 = 44px, mínimo táctil cómodo. */
export const INPUT_CLASS =
  'min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-500 focus:border-brand-500';

/** Campo compacto para grillas densas del panel (cantidades, escalones de precio). */
export const INPUT_COMPACT_CLASS =
  'min-h-11 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-900 focus:border-brand-500';

export const TEXTAREA_CLASS = `${INPUT_CLASS} resize-none`;

export const LABEL_CLASS = 'flex flex-col gap-1 text-sm';
export const LABEL_TEXT_CLASS = 'font-semibold text-stone-700';
