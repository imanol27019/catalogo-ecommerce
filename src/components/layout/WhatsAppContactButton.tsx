import { WHATSAPP_CONTACT_MESSAGE, WHATSAPP_NUMBER } from '../../config/site.config';
import { WhatsAppIcon } from '../ui/icons';

/** Contacto general flotante — distinto del botón de pedido del carrito. */
export function WhatsAppContactButton() {
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_CONTACT_MESSAGE)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Consultar por WhatsApp"
      className="fixed bottom-5 left-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition-transform hover:scale-105"
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}
