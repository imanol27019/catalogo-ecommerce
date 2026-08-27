import type { ProductColor, ProductVariant } from '../../types/product';

/** Recalcula la matriz talle×color preservando el stock de las combinaciones que siguen existiendo. */
export function regenerateVariants(
  sizes: string[],
  colors: ProductColor[],
  existing: ProductVariant[],
): ProductVariant[] {
  const next: ProductVariant[] = [];
  for (const size of sizes) {
    for (const color of colors) {
      const found = existing.find((v) => v.size === size && v.color === color.name);
      next.push(
        found
          ? { ...found, colorHex: color.hex }
          : {
              id: `${size}-${color.name}`.toLowerCase().replace(/\s+/g, '-'),
              size,
              color: color.name,
              colorHex: color.hex,
              stockStatus: 'in_stock',
            },
      );
    }
  }
  return next;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
