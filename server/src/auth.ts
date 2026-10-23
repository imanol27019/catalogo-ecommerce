import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Dos niveles de acceso al panel:
 * - `admin`: la dueña. Ve y toca todo (productos, costos, reportes, configuración).
 * - `seller`: las vendedoras. Cargan ventas, cobros y clientas, pero no ven costos ni ganancias
 *   ni pueden tocar el catálogo. Comparten una clave que la dueña define desde el panel.
 */
export type StaffRole = 'admin' | 'seller';

/** Hash de la clave de vendedoras (`sal:hash` en hex). `null` = no hay clave, nadie entra con ese rol. */
let sellerKeyHash: string | null = null;

export function setSellerKeyHash(hash: string | null): void {
  sellerKeyHash = hash;
}

/** La clave se guarda con scrypt y sal propia: aunque alguien lea la base, no la obtiene. */
export function hashSellerKey(key: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(key, salt, 32);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function matchesSellerKey(provided: string): boolean {
  if (!sellerKeyHash) return false;
  const [saltHex, hashHex] = sellerKeyHash.split(':');
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

function resolveRole(req: Request): StaffRole | null {
  const provided = req.header('x-admin-password') ?? '';
  if (!provided) return null;
  if (safeEqual(provided, process.env.ADMIN_PASSWORD ?? '')) return 'admin';
  if (matchesSellerKey(provided)) return 'seller';
  return null;
}

export function roleOf(res: Response): StaffRole {
  return res.locals.role as StaffRole;
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

    const role = resolveRole(req);
    if (!role) {
      res.status(401).json({ error: 'Contraseña incorrecta.' });
      return;
    }
    if (!allowed.includes(role)) {
      res.status(403).json({ error: 'Esta sección es solo para la administradora.' });
      return;
    }

    res.locals.role = role;
    next();
  };
}

/** Solo la dueña: catálogo, configuración, proveedores, costos y reportes. */
export const requireAdmin = guard(['admin']);

/** Dueña o vendedoras: ventas, cobros, entregas y clientas. */
export const requireStaff = guard(['admin', 'seller']);
