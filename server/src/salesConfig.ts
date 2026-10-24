/**
 * Configuración interna de ventas. Vive en su propia colección y no en `settings` porque
 * `GET /api/settings` es público, y acá hay datos que no tienen que salir del panel: los costos de
 * cada prenda, los nombres de las vendedoras y en qué cuenta entra cada cobro.
 */

export interface PaymentMethod {
  id: string;
  label: string;
}

export interface SalesConfig {
  /** Nombres de las vendedoras, para atribuir cada venta. */
  sellers: string[];
  /** Medios de pago, incluida la cuenta que recibe ("MP Ima", "MP Mary"…). */
  paymentMethods: PaymentMethod[];
  /** Costo por unidad de cada producto del catálogo (clave = id del producto). */
  costs: Record<string, number>;
  /** Cuántos días queda abierta la bolsa de una clienta de live para seguir sumando prendas. */
  bagDays: number;
  /** Hash de la clave de vendedoras (ver `auth.ts`). Nunca se devuelve al navegador. */
  sellerKeyHash: string | null;
  updatedAt?: string;
}

export const DEFAULT_SALES_CONFIG: SalesConfig = {
  sellers: [],
  paymentMethods: [
    { id: 'efectivo', label: 'Efectivo' },
    { id: 'transferencia', label: 'Transferencia / Mercado Pago' },
  ],
  costs: {},
  bagDays: 5,
  sellerKeyHash: null,
};

export class SalesConfigValidationError extends Error {}

const MAX_SELLERS = 30;
const MAX_METHODS = 15;
const MAX_COST = 10_000_000;

function slugify(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

/** Completa con valores por defecto lo que falte en un documento viejo o vacío. */
export function withDefaults(doc: Partial<SalesConfig> | null | undefined): SalesConfig {
  return {
    sellers: Array.isArray(doc?.sellers) ? doc.sellers : DEFAULT_SALES_CONFIG.sellers,
    paymentMethods:
      Array.isArray(doc?.paymentMethods) && doc.paymentMethods.length > 0
        ? doc.paymentMethods
        : DEFAULT_SALES_CONFIG.paymentMethods,
    costs: doc?.costs && typeof doc.costs === 'object' ? doc.costs : {},
    bagDays: typeof doc?.bagDays === 'number' && doc.bagDays > 0 ? doc.bagDays : DEFAULT_SALES_CONFIG.bagDays,
    sellerKeyHash: typeof doc?.sellerKeyHash === 'string' ? doc.sellerKeyHash : null,
    ...(doc?.updatedAt ? { updatedAt: doc.updatedAt } : {}),
  };
}

/**
 * Valida lo que manda el panel. Los ids de medios de pago que ya existían se conservan aunque
 * cambie el nombre visible, así los cobros viejos siguen apuntando al mismo medio.
 */
export function sanitizeSalesConfig(
  body: unknown,
): Pick<SalesConfig, 'sellers' | 'paymentMethods' | 'costs' | 'bagDays'> {
  const raw = (body ?? {}) as Record<string, unknown>;

  const sellers = [
    ...new Set(
      (Array.isArray(raw.sellers) ? raw.sellers : [])
        .map((s) => (typeof s === 'string' ? s.trim().slice(0, 40) : ''))
        .filter(Boolean),
    ),
  ].slice(0, MAX_SELLERS);

  const usedIds = new Set<string>();
  const paymentMethods: PaymentMethod[] = [];
  for (const item of Array.isArray(raw.paymentMethods) ? raw.paymentMethods : []) {
    const entry = (item ?? {}) as Record<string, unknown>;
    const label = typeof entry.label === 'string' ? entry.label.trim().slice(0, 40) : '';
    if (!label) continue;
    let id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim().slice(0, 40) : slugify(label);
    if (!id) id = `medio-${paymentMethods.length + 1}`;
    while (usedIds.has(id)) id = `${id}-2`;
    usedIds.add(id);
    paymentMethods.push({ id, label });
  }
  if (paymentMethods.length === 0) {
    throw new SalesConfigValidationError('Tiene que haber al menos un medio de pago.');
  }
  if (paymentMethods.length > MAX_METHODS) {
    throw new SalesConfigValidationError(`Como máximo podés tener ${MAX_METHODS} medios de pago.`);
  }

  const costs: Record<string, number> = {};
  const rawCosts = raw.costs && typeof raw.costs === 'object' ? (raw.costs as Record<string, unknown>) : {};
  for (const [productId, value] of Object.entries(rawCosts)) {
    const cost = Math.round(Number(value));
    if (productId && Number.isFinite(cost) && cost > 0 && cost <= MAX_COST) costs[productId.slice(0, 80)] = cost;
  }

  const bagDays = raw.bagDays === undefined ? DEFAULT_SALES_CONFIG.bagDays : Math.round(Number(raw.bagDays));
  if (!Number.isFinite(bagDays) || bagDays < 1 || bagDays > 60) {
    throw new SalesConfigValidationError('Los días de bolsa abierta tienen que ser entre 1 y 60.');
  }

  return { sellers, paymentMethods, costs, bagDays };
}
