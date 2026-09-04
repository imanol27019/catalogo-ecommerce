import {
  BUSINESS_NAME,
  BUSINESS_TAGLINE,
  CATEGORY_LABELS,
  CONTACT_ADDRESS,
  CONTACT_EMAIL,
  CONTACT_HOURS,
  WHATSAPP_NUMBER,
} from '../../config/site.config';
import { WhatsAppIcon } from '../ui/icons';
import { NewsletterForm } from './NewsletterForm';

interface FooterProps {
  categories: string[];
  onSelectCategory: (category: string) => void;
}

export function Footer({ categories, onSelectCategory }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-12 bg-plum-900 text-stone-300">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <p className="font-heading text-lg font-semibold text-white">{BUSINESS_NAME}</p>
          {/* Sobre el fondo oscuro del footer el texto secundario tiene que ir más claro, no más
              oscuro: stone-500 acá daba 3.65 de contraste. */}
          <p className="mt-1 text-sm text-stone-400">{BUSINESS_TAGLINE}</p>
          <p className="mt-4 text-sm">{CONTACT_ADDRESS}</p>
          <p className="text-sm">{CONTACT_HOURS}</p>
        </div>

        {categories.length > 0 && (
          <div>
            <p className="font-heading text-sm font-semibold text-white">Categorías</p>
            <ul className="mt-1 flex flex-col text-sm">
              {categories.map((category) => (
                <li key={category}>
                  <a
                    href="#catalogo"
                    onClick={() => onSelectCategory(category)}
                    className="inline-flex min-h-11 items-center hover:text-white"
                  >
                    {CATEGORY_LABELS[category] ?? category}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="font-heading text-sm font-semibold text-white">Contacto</p>
          <div className="mt-1 flex flex-col text-sm">
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 hover:text-white"
            >
              <WhatsAppIcon className="h-4 w-4" />
              WhatsApp
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex min-h-11 items-center hover:text-white">
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>

        <NewsletterForm />
      </div>

      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-stone-400 sm:px-6">
        © {year} {BUSINESS_NAME}. Precios mayoristas sujetos a stock — la compra se confirma por
        WhatsApp, no procesamos pagos online.
      </div>
    </footer>
  );
}
