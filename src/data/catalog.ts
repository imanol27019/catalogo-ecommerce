import type { Product, ProductCatalog } from '../types/product';
import productsData from './products.json';
import { apiGet, apiPut } from './apiClient';

/**
 * Objeto mutable: arranca con los datos de muestra empaquetados y `loadCatalog()` lo actualiza
 * en el lugar con lo que devuelva la API. Todo el resto del código lee `catalog.products`
 * (nunca lo desestructura en una constante), así que siempre ve el valor más reciente.
 */
export const catalog: ProductCatalog = productsData as ProductCatalog;

/** `true` cuando lo que se está mostrando son los datos de muestra porque la API no respondió. */
export let isUsingFallbackCatalog = false;

export async function loadCatalog(): Promise<void> {
  try {
    const data = await apiGet<ProductCatalog>('/api/products');
    catalog.updatedAt = data.updatedAt;
    catalog.products = data.products;
    isUsingFallbackCatalog = false;
  } catch (err) {
    // No se propaga: es preferible mostrar el catálogo de muestra a dejar la pantalla en blanco.
    // El aviso al visitante lo da `isUsingFallbackCatalog`.
    isUsingFallbackCatalog = true;
    console.warn('No se pudo cargar el catálogo desde la API — se usan los datos de muestra.', err);
  }
}

export async function saveCatalog(products: Product[], adminPassword: string): Promise<void> {
  const data = await apiPut<ProductCatalog>('/api/products', { products }, adminPassword);
  catalog.updatedAt = data.updatedAt;
  catalog.products = data.products;
  isUsingFallbackCatalog = false;
}
