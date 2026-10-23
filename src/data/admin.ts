import type { StaffRole } from '../types/sales';
import { apiGet } from './apiClient';

/**
 * Comprueba la contraseña contra el servidor antes de dejar entrar al panel, y devuelve con qué
 * rol entra: la clave de administradora abre todo; la de vendedoras, solo ventas y clientas.
 */
export async function verifyStaffPassword(password: string): Promise<StaffRole> {
  const { role } = await apiGet<{ ok: true; role?: StaffRole }>('/api/admin/verify', password);
  return role ?? 'admin';
}
