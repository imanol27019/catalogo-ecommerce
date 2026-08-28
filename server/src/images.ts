import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { Binary } from 'mongodb';

/**
 * Las fotos se guardan tal cual llegan, sin recomprimir ni redimensionar: el catálogo mayorista
 * necesita que se vea bien la tela y el color, así que cualquier reencodeo iría en contra.
 * Se almacenan como binario en Mongo (un documento admite hasta 16 MB, de sobra para una foto).
 */

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'];

export interface StoredImage {
  _id: string;
  contentType: string;
  size: number;
  data: Binary;
  createdAt: string;
}

export class ImageValidationError extends Error {}

export async function storeImage(
  images: Collection,
  buffer: Buffer,
  contentType: string,
): Promise<{ id: string; url: string; size: number }> {
  if (!buffer || buffer.length === 0) {
    throw new ImageValidationError('La imagen llegó vacía.');
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new ImageValidationError(
      `La imagen pesa ${(buffer.length / 1024 / 1024).toFixed(1)} MB y el máximo es ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
    );
  }
  const type = (contentType || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(type)) {
    throw new ImageValidationError(`Formato no admitido (${type || 'desconocido'}). Usá JPG, PNG o WebP.`);
  }

  const id = randomUUID();
  await images.insertOne({
    _id: id as never,
    contentType: type,
    size: buffer.length,
    data: new Binary(buffer),
    createdAt: new Date().toISOString(),
  });

  return { id, url: `/api/images/${id}`, size: buffer.length };
}
