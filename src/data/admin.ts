import { apiGet } from './apiClient';

/**
 * Comprueba la contraseña contra el servidor antes de dejar entrar al panel.
 * Antes el login la aceptaba sin validar y el error recién aparecía cuando alguna pantalla
 * interna recibía un 401, así que se veía el panel un instante y volvía al login sin explicación.
 */
export async function verifyAdminPassword(password: string): Promise<void> {
  await apiGet<{ ok: true }>('/api/admin/verify', password);
}
