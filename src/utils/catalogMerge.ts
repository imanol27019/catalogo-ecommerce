import type { Product } from '../types/product';

function sameProduct(a: Product, b: Product): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Une los cambios del panel con el catálogo que hay en el servidor antes de publicar.
 *
 * Mientras la dueña edita productos o stock, las vendedoras pueden estar registrando ventas que
 * descuentan stock en el servidor. Publicar la copia del panel tal cual pisaría esos descuentos y
 * "devolvería" prendas ya vendidas. Por eso es una unión de tres versiones:
 *
 * - `base`: el catálogo como estaba cuando el panel lo cargó (o lo publicó por última vez).
 * - `local`: lo que hay en el panel ahora, con los cambios de la dueña.
 * - `remote`: lo que hay hoy en el servidor, con las ventas que pasaron mientras tanto.
 *
 * Producto que la dueña no tocó → se queda el del servidor. Producto que sí tocó → se queda el de
 * ella, pero las unidades de cada talle/color se recalculan como "lo del servidor + lo que ella
 * sumó o restó", así su ajuste y las ventas conviven.
 */
export function mergeCatalog(base: Product[], local: Product[], remote: Product[]): Product[] {
  const baseById = new Map(base.map((p) => [p.id, p]));
  const remoteById = new Map(remote.map((p) => [p.id, p]));
  const localIds = new Set(local.map((p) => p.id));

  const merged = local.map((product) => {
    const before = baseById.get(product.id);
    const now = remoteById.get(product.id);
    if (!before || !now) return product;
    if (sameProduct(before, product)) return now;

    return {
      ...product,
      variants: product.variants.map((variant) => {
        const was = before.variants.find((v) => v.id === variant.id);
        const is = now.variants.find((v) => v.id === variant.id);
        if (!was || !is) return variant;
        const adjustment = variant.stockQty - was.stockQty;
        return { ...variant, stockQty: Math.max(0, is.stockQty + adjustment) };
      }),
    };
  });

  // Productos que aparecieron en el servidor desde otra sesión y este panel nunca vio.
  for (const product of remote) {
    if (!baseById.has(product.id) && !localIds.has(product.id)) merged.push(product);
  }
  return merged;
}
