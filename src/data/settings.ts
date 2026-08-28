import type { SiteSettings } from '../types/settings';
import settingsData from './settings.json';
import { apiGet, apiPut } from './apiClient';

/** Mismo patrón que `catalog`: objeto mutable, poblado desde la API antes del primer render. */
export const settings: SiteSettings = settingsData as SiteSettings;

export let isUsingFallbackSettings = false;

export async function loadSettings(): Promise<void> {
  try {
    const data = await apiGet<Partial<SiteSettings>>('/api/settings');
    if (data && Object.keys(data).length > 0) {
      Object.assign(settings, data);
    }
    isUsingFallbackSettings = false;
  } catch (err) {
    isUsingFallbackSettings = true;
    console.warn('No se pudo cargar la configuración desde la API — se usan los valores de muestra.', err);
  }
}

export async function saveSettings(updated: SiteSettings, adminPassword: string): Promise<void> {
  const data = await apiPut<SiteSettings>('/api/settings', updated, adminPassword);
  Object.assign(settings, data);
  isUsingFallbackSettings = false;
}
