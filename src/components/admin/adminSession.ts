import { createContext, useContext } from 'react';
import type { StaffRole } from '../../types/sales';
import { ApiError } from '../../data/apiClient';

export interface AdminSession {
  password: string;
  role: StaffRole;
  /** Nombre de la vendedora que entró (sus ventas quedan a su nombre). Vacío si es la dueña. */
  sellerName?: string;
  /** Se llama cuando el servidor rechaza la clave: el panel vuelve al login. */
  onAuthError: () => void;
}

export const AdminSessionContext = createContext<AdminSession | null>(null);

export function useAdminSession(): AdminSession {
  const session = useContext(AdminSessionContext);
  if (!session) throw new Error('useAdminSession tiene que usarse dentro del panel.');
  return session;
}

/**
 * Traduce un error de la API a un mensaje para mostrar. Si la clave dejó de valer, cierra la sesión
 * y devuelve `null` (no hay nada que mostrar: la pantalla pasa al login).
 */
export function describeApiError(err: unknown, session: AdminSession, fallback: string): string | null {
  if (err instanceof ApiError && err.status === 401) {
    session.onAuthError();
    return null;
  }
  return err instanceof ApiError ? err.userMessage : fallback;
}
