import { randomUUID } from 'node:crypto';
import { hashPassword } from './auth';

/**
 * Configuración interna de ventas. Vive en su propia colección y no en `settings` porque
 * `GET /api/settings` es público, y acá hay datos que no tienen que salir del panel: los costos de
 * cada prenda, las cuentas de las vendedoras y en qué cuenta entra cada cobro.
 */

export interface PaymentMethod {
  id: string;
  label: string;
}

/**
 * Vendedora. Con usuario y contraseña entra al panel (solo Ventas y Clientas) y sus ventas quedan
 * a su nombre. Sin contraseña igual se le pueden atribuir ventas, pero no puede entrar.
 */
export interface SellerAccount {
  id: string;
  name: string;
  /** Único, en minúsculas. Es lo que escribe al entrar. */
  username: string;
  /** scrypt con sal propia (ver `auth.ts`). `null` = sin acceso al panel. */
  passwordHash: string | null;
}

/** Textos de los mensajes de WhatsApp, editables desde el panel. Ver `MESSAGE_VARIABLES` en el panel. */
export interface MessageTemplates {
  summary: string;
  dispatch: string;
}

export interface SalesConfig {
  sellerAccounts: SellerAccount[];
  /** Medios de pago, incluida la cuenta que recibe ("MP Ima", "MP Mary"…). */
  paymentMethods: PaymentMethod[];
  /** Costo por unidad de cada producto del catálogo (clave = id del producto). */
  costs: Record<string, number>;
  /** Cuántos días queda abierta la bolsa de una clienta de live para seguir sumando prendas. */
  bagDays: number;
  /** Vacío = se usan los textos de fábrica del panel. */
  messageTemplates: Partial<MessageTemplates>;
  updatedAt?: string;
}

export const DEFAULT_SALES_CONFIG: SalesConfig = {
  sellerAccounts: [],
  paymentMethods: [
    { id: 'efectivo', label: 'Efectivo' },
    { id: 'transferencia', label: 'Transferencia / Mercado Pago' },
  ],
  costs: {},
  bagDays: 5,
  messageTemplates: {},
};

export class SalesConfigValidationError extends Error {}

const MAX_SELLERS = 30;
const MAX_METHODS = 15;
const MAX_COST = 10_000_000;
const MAX_TEMPLATE = 2000;
const USERNAME = /^[a-z0-9._-]{3,30}$/;

function slugify(label: string, separator = '-'): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^\\${separator}|\\${separator}$`, 'g'), '')
    .slice(0, 30);
}

/**
 * Antes las vendedoras eran solo una lista de nombres (y una clave compartida). Esos nombres se
 * convierten en cuentas sin contraseña: siguen sirviendo para atribuir ventas, y la dueña les crea
 * la contraseña cuando quiera que entren.
 */
function legacySellers(names: unknown): SellerAccount[] {
  if (!Array.isArray(names)) return [];
  return names
    .filter((n): n is string => typeof n === 'string' && n.trim() !== '')
    .map((name) => ({ id: randomUUID(), name: name.trim(), username: slugify(name, '.') || 'vendedora', passwordHash: null }));
}

/** Completa con valores por defecto lo que falte en un documento viejo o vacío. */
export function withDefaults(doc: (Partial<SalesConfig> & { sellers?: unknown }) | null | undefined): SalesConfig {
  return {
    sellerAccounts: Array.isArray(doc?.sellerAccounts) ? doc.sellerAccounts : legacySellers(doc?.sellers),
    paymentMethods:
      Array.isArray(doc?.paymentMethods) && doc.paymentMethods.length > 0
        ? doc.paymentMethods
        : DEFAULT_SALES_CONFIG.paymentMethods,
    costs: doc?.costs && typeof doc.costs === 'object' ? doc.costs : {},
    bagDays: typeof doc?.bagDays === 'number' && doc.bagDays > 0 ? doc.bagDays : DEFAULT_SALES_CONFIG.bagDays,
    messageTemplates: doc?.messageTemplates && typeof doc.messageTemplates === 'object' ? doc.messageTemplates : {},
    ...(doc?.updatedAt ? { updatedAt: doc.updatedAt } : {}),
  };
}

/**
 * Las cuentas que manda el panel. La contraseña nunca vuelve del servidor: si no viene, se
 * conserva la que tenía; `null` le quita el acceso; un texto la reemplaza.
 */
function sanitizeSellerAccounts(raw: unknown, current: SellerAccount[]): SellerAccount[] {
  const list = Array.isArray(raw) ? raw : [];
  if (list.length > MAX_SELLERS) throw new SalesConfigValidationError(`Como máximo podés tener ${MAX_SELLERS} vendedoras.`);

  const usernames = new Set<string>();
  return list.map((item) => {
    const entry = (item ?? {}) as Record<string, unknown>;
    const name = typeof entry.name === 'string' ? entry.name.trim().slice(0, 40) : '';
    if (!name) throw new SalesConfigValidationError('Cada vendedora necesita un nombre.');

    const username = (typeof entry.username === 'string' ? entry.username.trim().toLowerCase() : '') || slugify(name, '.');
    if (!USERNAME.test(username)) {
      throw new SalesConfigValidationError(
        `El usuario de ${name} tiene que tener entre 3 y 30 letras sin acento, números, puntos o guiones (sin espacios).`,
      );
    }
    if (usernames.has(username)) throw new SalesConfigValidationError(`Hay dos vendedoras con el usuario "${username}".`);
    usernames.add(username);

    const existing = current.find((s) => s.id === entry.id);
    let passwordHash = existing?.passwordHash ?? null;
    if (entry.password === null) {
      passwordHash = null;
    } else if (typeof entry.password === 'string' && entry.password !== '') {
      const password = entry.password.trim();
      if (password.length < 6) throw new SalesConfigValidationError(`La contraseña de ${name} tiene que tener al menos 6 caracteres.`);
      if (password === process.env.ADMIN_PASSWORD) {
        throw new SalesConfigValidationError('La contraseña de una vendedora no puede ser igual a la de administradora.');
      }
      passwordHash = hashPassword(password);
    }

    return { id: existing?.id ?? randomUUID(), name, username, passwordHash };
  });
}

/**
 * Valida lo que manda el panel. Los ids de medios de pago que ya existían se conservan aunque
 * cambie el nombre visible, así los cobros viejos siguen apuntando al mismo medio.
 */
export function sanitizeSalesConfig(body: unknown, current: SalesConfig): Omit<SalesConfig, 'updatedAt'> {
  const raw = (body ?? {}) as Record<string, unknown>;

  const sellerAccounts =
    raw.sellerAccounts === undefined ? current.sellerAccounts : sanitizeSellerAccounts(raw.sellerAccounts, current.sellerAccounts);

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

  const bagDays = raw.bagDays === undefined ? current.bagDays : Math.round(Number(raw.bagDays));
  if (!Number.isFinite(bagDays) || bagDays < 1 || bagDays > 60) {
    throw new SalesConfigValidationError('Los días de bolsa abierta tienen que ser entre 1 y 60.');
  }

  const messageTemplates: Partial<MessageTemplates> = {};
  const rawTemplates = (raw.messageTemplates ?? {}) as Record<string, unknown>;
  for (const key of ['summary', 'dispatch'] as const) {
    const value = rawTemplates[key];
    // Vacío = volver al texto de fábrica.
    if (typeof value === 'string' && value.trim()) messageTemplates[key] = value.slice(0, MAX_TEMPLATE);
  }

  return { sellerAccounts, paymentMethods, costs, bagDays, messageTemplates };
}
