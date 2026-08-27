import type { NextFunction, Request, Response } from 'express';

/**
 * Protege las rutas de escritura. Sin ADMIN_PASSWORD configurado, las escrituras quedan
 * bloqueadas (fail-safe) en vez de quedar abiertas por accidente (fail-open).
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(500).json({ error: 'ADMIN_PASSWORD no está configurado en el servidor.' });
    return;
  }

  const provided = req.header('x-admin-password');
  if (provided !== expected) {
    res.status(401).json({ error: 'Contraseña de administrador incorrecta.' });
    return;
  }

  next();
}
