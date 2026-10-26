import type { SellerAccountInfo, SellerAccountPayload } from '../types/sales';

/** Vendedora en edición. La contraseña nunca vuelve del servidor: acá solo se escribe una nueva. */
export interface SellerDraft {
  key: string;
  id?: string;
  name: string;
  username: string;
  /** Si hoy ya puede entrar al panel. */
  hasAccess: boolean;
  /** Contraseña nueva; vacío = no cambiarla. */
  password: string;
  removeAccess: boolean;
  /** Mientras no se toque, el usuario se arma solo a partir del nombre. */
  usernameEdited: boolean;
}

let draftSeed = 0;
export function nextSellerKey(): string {
  draftSeed += 1;
  return `s${draftSeed}`;
}

export function usernameFrom(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '')
    .slice(0, 30);
}

export function sellerDraftsFrom(accounts: SellerAccountInfo[] | undefined): SellerDraft[] {
  return (accounts ?? []).map((a) => ({
    key: nextSellerKey(),
    id: a.id,
    name: a.name,
    username: a.username,
    hasAccess: a.hasAccess,
    password: '',
    removeAccess: false,
    usernameEdited: true,
  }));
}

/** Lo que falta corregir antes de guardar, o `null`. */
export function validateSellerDrafts(drafts: SellerDraft[]): string | null {
  const seen = new Set<string>();
  for (const d of drafts) {
    if (!d.name.trim()) return 'Cada vendedora necesita un nombre.';
    const username = d.username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      return `El usuario de ${d.name.trim()} tiene que tener entre 3 y 30 letras sin acento, números o puntos, sin espacios.`;
    }
    if (seen.has(username)) return `Hay dos vendedoras con el usuario "${username}".`;
    seen.add(username);
    if (d.password && d.password.trim().length < 6) return `La contraseña de ${d.name.trim()} tiene que tener al menos 6 caracteres.`;
  }
  return null;
}

export function sellerPayloadFrom(drafts: SellerDraft[]): SellerAccountPayload[] {
  return drafts.map((d) => ({
    ...(d.id ? { id: d.id } : {}),
    name: d.name.trim(),
    username: d.username.trim().toLowerCase(),
    ...(d.removeAccess ? { password: null } : d.password.trim() ? { password: d.password.trim() } : {}),
  }));
}
