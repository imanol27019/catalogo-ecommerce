import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Dos niveles de acceso al panel:
 * - `admin`: la dueña. Entra solo con su contraseña y ve y toca todo.
 * - `seller`: cada vendedora, con su usuario y contraseña. Carga ventas, cobros y clientas, pero no
 *   ve costos ni ganancias ni puede tocar el catálogo. Sus ventas quedan a su nombre.
 */
export type StaffRole = 'admin' | 'seller';

interface SellerLogin {
  name: string;
  passwordHash: string;
}

/** Cuentas que pueden entrar, por usuario. Se cargan al arrancar y al guardar la configuración. */
let sellerLogins = new Map<string, SellerLogin>();

export function setSellerLogins(accounts: { name: string; username: string; passwordHash: string | null }[]): void {
  sellerLogins = new Map(
    accounts
      .filter((a): a is typeof a & { passwordHash: string } => Boolean(a.passwordHash))
      .map((a) => [a.username, { name: a.name, passwordHash: a.passwordHash }]),
  );
}

/** Las contraseñas se guardan con scrypt y sal propia: aunque alguien lea la base, no las obtiene. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function matchesHash(provided: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(provided, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(expected, actual);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function resolveIdentity(req: Request): { role: StaffRole; sellerName?: string } | null {
  const provided = req.header('x-admin-password') ?? '';
  if (!provided) return null;
  const username = (req.header('x-staff-user') ?? '').trim().toLowerCase();

  if (!username) return safeEqual(provided, process.env.ADMIN_PASSWORD ?? '') ? { role: 'admin' } : null;

  const login = sellerLogins.get(username);
  if (login && matchesHash(provided, login.passwordHash)) return { role: 'seller', sellerName: login.name };
  return null;
}

export function roleOf(res: Response): StaffRole {
  return res.locals.role as StaffRole;
}

/** Nombre de la vendedora que hizo el pedido, si entró una vendedora. */
export function sellerNameOf(res: Response): string | undefined {
  return res.locals.sellerName as string | undefined;
}

/**
 * Sin ADMIN_PASSWORD configurado, las escrituras quedan bloqueadas (fail-safe) en vez de quedar
 * abiertas por accidente (fail-open).
 */
function guard(allowed: StaffRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!process.env.ADMIN_PASSWORD) {
      res.status(500).json({ error: 'ADMIN_PASSWORD no está configurado en el servidor.' });
      return;
    }

    const identity = resolveIdentity(req);
    if (!identity) {
      res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
      return;
    }
    if (!allowed.includes(identity.role)) {
      res.status(403).json({ error: 'Esta sección es solo para la administradora.' });
      return;
    }

    res.locals.role = identity.role;
    res.locals.sellerName = identity.sellerName;
    next();
  };
}

/** Solo la dueña: catálogo, configuración, proveedores, costos y reportes. */
export const requireAdmin = guard(['admin']);

/** Dueña o vendedoras: ventas, cobros, entregas y clientas. */
export const requireStaff = guard(['admin', 'seller']);
