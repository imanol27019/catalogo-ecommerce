import { randomUUID } from 'node:crypto';

/**
 * Ficha de una clienta. Es la misma persona compre en el local, en un live de TikTok o por
 * WhatsApp: tenerla una sola vez es lo que permite ver cuánto compra en total y qué debe.
 */
export interface Client {
  id: string;
  /** Nombre o apodo con el que la conocen. Es lo único obligatorio. */
  name: string;
  /** Usuario de TikTok sin la arroba, en minúsculas: así se la encuentra durante un live. */
  tiktok?: string;
  /** Solo dígitos (549...), para abrir WhatsApp directo. */
  whatsapp?: string;
  locality?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export class ClientValidationError extends Error {}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function normalizeTiktok(value: unknown): string {
  return text(value, 60).replace(/^@+/, '').replace(/\s+/g, '').toLowerCase().slice(0, 40);
}

export function normalizeWhatsapp(value: unknown): string {
  return text(value, 40).replace(/\D/g, '').slice(0, 20);
}

/** Arma la ficha a partir de lo que manda el panel, conservando id y fecha de alta si ya existía. */
export function buildClient(body: unknown, existing?: Client): Client {
  const raw = (body ?? {}) as Record<string, unknown>;
  const name = text(raw.name, 80);
  if (!name) throw new ClientValidationError('Falta el nombre de la clienta.');

  const tiktok = normalizeTiktok(raw.tiktok);
  const whatsapp = normalizeWhatsapp(raw.whatsapp);
  const locality = text(raw.locality, 80);
  const notes = text(raw.notes, 500);
  const now = new Date().toISOString();

  return {
    id: existing?.id ?? randomUUID(),
    name,
    ...(tiktok ? { tiktok } : {}),
    ...(whatsapp ? { whatsapp } : {}),
    ...(locality ? { locality } : {}),
    ...(notes ? { notes } : {}),
    createdAt: existing?.createdAt ?? now,
    ...(existing ? { updatedAt: now } : {}),
  };
}
