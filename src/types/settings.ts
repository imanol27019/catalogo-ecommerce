export interface ShippingMethodOption {
  id: string;
  label: string;
  description?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface HeroContent {
  eyebrow: string;
  heading: string;
  subtext: string;
  ctaLabel: string;
  /** Fotos de fondo del banner, en rotación. Vacío = degradé de marca en su lugar. */
  images: string[];
}

export interface NewsletterSettings {
  enabled: boolean;
  title: string;
  subtext: string;
}

export interface SiteSettings {
  businessName: string;
  businessTagline: string;
  whatsappNumber: string;
  whatsappContactMessage: string;
  contactEmail: string;
  contactAddress: string;
  contactHours: string;
  currency: string;
  locale: string;
  shippingMethods: ShippingMethodOption[];
  /** Mínimo de prendas (unidades totales del carrito) para poder finalizar el pedido. 0 = sin mínimo. */
  minOrderQty: number;
  /** Mínimo de monto total del carrito para poder finalizar el pedido. 0 = sin mínimo. */
  minOrderTotal: number;
  /** Mensaje manual de la barra superior. `null` = generarlo automáticamente a partir de los mínimos. */
  announcementMessage: string | null;
  categoryLabels: Record<string, string>;
  categoryOrder: string[];
  syncFiltersToUrl: boolean;
  maxWhatsAppMessageLength: number;
  hero: HeroContent;
  faq: FaqItem[];
  newsletter: NewsletterSettings;
}
