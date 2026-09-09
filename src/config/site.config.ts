/**
 * Puente de compatibilidad: el dato real de la tienda vive en `src/data/settings.json` y se edita
 * desde el panel admin (`#/admin` → Configuración) o a mano. Este archivo solo re-exporta esos
 * valores como constantes con nombre para no romper los imports existentes en el resto del código
 * (`import { BUSINESS_NAME } from '../config/site.config'`).
 */

import { settings } from '../data/settings';

export const BUSINESS_NAME = settings.businessName;
export const BUSINESS_TAGLINE = settings.businessTagline;

/**
 * Número de WhatsApp SOLO DÍGITOS (sin +, sin espacios, sin guiones).
 * Formato Argentina: 549 + código de área SIN el 0 + número SIN el 15.
 * IMPORTANTE: probar el link generado en un teléfono real antes de publicar el sitio.
 */
export const WHATSAPP_NUMBER = settings.whatsappNumber;
export const WHATSAPP_CONTACT_MESSAGE = settings.whatsappContactMessage;

export const CONTACT_EMAIL = settings.contactEmail;
export const CONTACT_ADDRESS = settings.contactAddress;
export const CONTACT_HOURS = settings.contactHours;

export const CURRENCY = settings.currency;
export const LOCALE = settings.locale;

export const SHIPPING_METHODS = settings.shippingMethods;

/** Mínimos para poder finalizar el pedido (cantidad O monto) — 0 desactiva ese mínimo. */
export const MIN_ORDER_QTY = settings.minOrderQty;
export const MIN_ORDER_TOTAL = settings.minOrderTotal;

export const ANNOUNCEMENT_MESSAGE = settings.announcementMessage ?? undefined;

/** Etiqueta prolija + orden de despliegue para categorías. Cualquier categoría del JSON que no
 * esté acá igual se muestra (con el valor tal cual, capitalizado). */
export const CATEGORY_LABELS = settings.categoryLabels;
export const CATEGORY_ORDER = settings.categoryOrder;

/** Refleja los filtros activos en la URL (para compartir/recargar sin perderlos). */
export const SYNC_FILTERS_TO_URL = settings.syncFiltersToUrl;

/** Límite de caracteres del mensaje de WhatsApp antes de truncar el detalle de ítems. */
export const MAX_WHATSAPP_MESSAGE_LENGTH = settings.maxWhatsAppMessageLength;

export const HERO = settings.hero;
export const FAQ = settings.faq;
export const NEWSLETTER = settings.newsletter;

export const SITE_META = {
  title: `${BUSINESS_NAME} | Catálogo Mayorista`,
  description: 'Catálogo mayorista de indumentaria. Consultá stock y precios por WhatsApp.',
};

export type { ShippingMethodOption } from '../types/settings';

/**
 * Máximo de caracteres del nombre de un producto. 60 es lo que usan la mayoría de los catálogos
 * (MercadoLibre, Amazon) antes de cortar el título en la tarjeta: entra en dos renglones y sigue
 * siendo descriptivo. La tarjeta igual recorta visualmente, por si quedan nombres viejos más largos.
 */
export const PRODUCT_NAME_MAX_LENGTH = 60;
