import { MIN_ORDER_QTY, MIN_ORDER_TOTAL, SHIPPING_METHODS, WHATSAPP_NUMBER, WHATSAPP_CONTACT_MESSAGE } from '../../config/site.config';
import { formatCurrency } from '../../utils/format';
import { WhatsAppIcon } from '../ui/icons';

/**
 * Explica el circuito de compra completo.
 *
 * El texto de los pasos va en código y no en la configuración a propósito: describe cómo funciona
 * el sitio de verdad, así que si fuera editable se podría dejar escrito algo que el sitio no hace.
 * Lo que sí sale de la configuración son los mínimos y los métodos de envío, que son los datos que
 * cambian — así nunca quedan desactualizados respecto de lo que valida el carrito.
 */
function describeMinimo(): string {
  const partes: string[] = [];
  if (MIN_ORDER_QTY > 0) partes.push(`${MIN_ORDER_QTY} prendas`);
  if (MIN_ORDER_TOTAL > 0) partes.push(formatCurrency(MIN_ORDER_TOTAL));
  if (partes.length === 0) return 'No hay mínimo de compra: armá el pedido con lo que necesites.';
  if (partes.length === 1) return `Necesitás llegar a ${partes[0]} para poder finalizar el pedido.`;
  return `Necesitás llegar a ${partes[0]} o a ${partes[1]} — con cumplir una de las dos alcanza.`;
}

const PASOS = [
  {
    titulo: 'Armá tu pedido',
    texto:
      'Elegí los modelos, el talle y el color, y sumalos al carrito. Podés combinar todos los modelos que quieras: las cantidades se suman.',
  },
  {
    titulo: 'Llegá al mínimo mayorista',
    texto: describeMinimo(),
  },
  {
    titulo: 'Finalizá por WhatsApp',
    texto:
      'Al tocar "Finalizar por WhatsApp" se abre el chat con tu pedido ya escrito: modelos, talles, colores, cantidades y total. No hace falta que copies nada.',
  },
  {
    titulo: 'Acordamos envío y pago',
    texto: `Por el chat coordinamos cómo te lo mandamos (${SHIPPING_METHODS.map((m) => m.label).join(', ')}) y de qué forma abonás.`,
  },
  {
    titulo: 'Confirmamos y despachamos',
    texto:
      'Cuando está la seña o el pago completo, confirmamos la venta, descontamos el stock y preparamos el pedido para que salga.',
  },
];

export function HowToBuySection() {
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_CONTACT_MESSAGE)}`;

  return (
    <section id="como-comprar" className="w-full min-w-0 scroll-mt-24 bg-brand-50 py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-8 max-w-xl">
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Paso a paso</p>
          <h2 className="mt-1.5 font-heading text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            Cómo comprar
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-700">
            Somos venta mayorista y cerramos todo por WhatsApp.{' '}
            <strong className="font-semibold">En la web no se paga nada</strong>: el envío y la forma de pago los
            acordamos por chat, con una persona del otro lado.
          </p>
        </div>

        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PASOS.map((paso, index) => (
            <li
              key={paso.titulo}
              className="flex gap-3 rounded-2xl border border-brand-100 bg-white p-4 shadow-sm"
            >
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 font-heading text-sm font-bold text-white"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <h3 className="font-heading text-base font-semibold text-stone-900">{paso.titulo}</h3>
                <p className="mt-1 text-sm leading-relaxed text-stone-700">{paso.texto}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a
            href="#catalogo"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-600 px-5 font-heading text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Ver el catálogo
          </a>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-5 font-heading text-sm font-semibold text-stone-900 transition-colors hover:bg-stone-50"
          >
            <WhatsAppIcon className="h-4 w-4 text-whatsapp" />
            Hacer una consulta
          </a>
        </div>
      </div>
    </section>
  );
}
