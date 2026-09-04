import type { Supplier, SupplierDirectory } from '../types/supplier';
import { apiGet, apiPut } from './apiClient';

/**
 * Los proveedores son datos internos: no se precargan con el catálogo público, se piden recién
 * cuando se abre la sección del panel y siempre con la contraseña.
 */
export async function fetchSuppliers(adminPassword: string): Promise<Supplier[]> {
  const data = await apiGet<SupplierDirectory>('/api/suppliers', adminPassword);
  return data.suppliers ?? [];
}

export async function saveSuppliers(suppliers: Supplier[], adminPassword: string): Promise<Supplier[]> {
  const data = await apiPut<SupplierDirectory>('/api/suppliers', { suppliers }, adminPassword);
  return data.suppliers ?? [];
}
