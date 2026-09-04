/**
 * Datos de contacto de un proveedor. Es información interna del negocio: nunca se expone en el
 * catálogo público, solo se lee desde el panel con la contraseña de administrador.
 */
export interface Supplier {
  id: string;
  /** Nombre del proveedor o del showroom. Es lo único obligatorio. */
  name: string;
  /** Persona con la que se habla, si es distinta del nombre del negocio. */
  contactName?: string;
  /** Solo dígitos, formato internacional (549...), para poder abrir WhatsApp directo. */
  whatsapp?: string;
  phone?: string;
  email?: string;
  address?: string;
  /** Días de entrega, mínimos de compra, formas de pago… lo que convenga recordar. */
  notes?: string;
  updatedAt?: string;
}

export interface SupplierDirectory {
  updatedAt: string;
  suppliers: Supplier[];
}
