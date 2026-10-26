import type { StaffRole } from '../types/sales';
import { apiGet, setStaffUser } from './apiClient';

/**
 * Comprueba usuario y contraseña contra el servidor antes de dejar entrar al panel, y devuelve
 * con qué rol entra. La administradora entra sin usuario; cada vendedora, con el suyo.
 */
export async function verifyStaffLogin(
  password: string,
  user: string | null,
): Promise<{ role: StaffRole; sellerName?: string }> {
  setStaffUser(user);
  try {
    const { role, sellerName } = await apiGet<{ ok: true; role?: StaffRole; sellerName?: string }>(
      '/api/admin/verify',
      password,
    );
    return { role: role ?? 'admin', ...(sellerName ? { sellerName } : {}) };
  } catch (err) {
    setStaffUser(null);
    throw err;
  }
}
