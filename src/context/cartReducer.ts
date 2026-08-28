import type { CartAction, CartLineItem, CartState } from '../types/cart';
import type { Product } from '../types/product';
import { findVariant } from '../utils/stock';
import { getEffectivePrice } from '../utils/pricing';

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { item } = action.payload;
      const existing = state.items.find((i) => i.lineId === item.lineId);
      const items = existing
        ? state.items.map((i) => (i.lineId === item.lineId ? { ...i, qty: i.qty + item.qty } : i))
        : [...state.items, item];
      return { ...state, items, isDrawerOpen: true };
    }
    case 'UPDATE_QTY': {
      const { lineId, qty } = action.payload;
      const items =
        qty <= 0
          ? state.items.filter((i) => i.lineId !== lineId)
          : state.items.map((i) => (i.lineId === lineId ? { ...i, qty } : i));
      return { ...state, items };
    }
    case 'ADJUST_QTY': {
      const { lineId, delta } = action.payload;
      const items = state.items
        .map((i) => (i.lineId === lineId ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0);
      return { ...state, items };
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((i) => i.lineId !== action.payload.lineId) };
    case 'CLEAR_CART':
      return { ...state, items: [] };
    case 'OPEN_DRAWER':
      return { ...state, isDrawerOpen: true };
    case 'CLOSE_DRAWER':
      return { ...state, isDrawerOpen: false };
    case 'HYDRATE':
      return { ...state, items: action.payload.items };
    case 'RECONCILE_WITH_CATALOG':
      return { ...state, items: action.payload.items };
    default:
      return state;
  }
}

/**
 * Corrige el carrito persistido contra el catálogo actual: quita líneas cuyo producto/variante
 * ya no exista (informando cuáles) y refresca precio/mínimo de las que sí siguen vigentes.
 * No quita una línea solo porque esa variante haya pasado a "sin stock" — el vendedor decide.
 */
export function reconcileCartItems(
  items: CartLineItem[],
  products: Product[],
): { items: CartLineItem[]; removedNames: string[] } {
  const removedNames: string[] = [];
  const reconciled: CartLineItem[] = [];

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId && p.status === 'active');
    const variant = product ? findVariant(product, item.size, item.color) : undefined;

    if (!product || !variant) {
      removedNames.push(`${item.productName} (Talle ${item.size} / ${item.color})`);
      continue;
    }

    reconciled.push({
      ...item,
      // Se refresca por si el carrito venía guardado de antes de que existiera este campo.
      variantId: variant.id,
      productName: product.name,
      image: product.images[0] ?? item.image,
      unitPrice: getEffectivePrice(product),
      bulkPricing: product.bulkPricing,
      minQtyPerVariant: variant.minQtyOverride ?? product.minQtyPerVariant,
    });
  }

  return { items: reconciled, removedNames };
}
