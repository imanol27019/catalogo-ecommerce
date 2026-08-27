import { useContext, useMemo } from 'react';
import { CartContext } from '../context/cartContextObject';
import { catalog } from '../data/catalog';
import type { CartLineItem } from '../types/cart';
import type { Product, ProductVariant } from '../types/product';
import { computeCartTotals, getEffectivePrice } from '../utils/pricing';
import { validateCart } from '../utils/validation';

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>');
  const { state, dispatch, removedNotice, dismissRemovedNotice } = ctx;

  const totals = useMemo(() => computeCartTotals(state.items), [state.items]);
  const validation = useMemo(() => validateCart(state.items, catalog.products), [state.items]);

  function addItem(product: Product, variant: ProductVariant, qty: number) {
    const lineId = `${product.id}__${variant.size}__${variant.color}`;
    const item: CartLineItem = {
      lineId,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      image: product.images[0] ?? '',
      size: variant.size,
      color: variant.color,
      colorHex: variant.colorHex,
      unitPrice: getEffectivePrice(product),
      bulkPricing: product.bulkPricing,
      minQtyPerVariant: variant.minQtyOverride ?? product.minQtyPerVariant,
      qty,
    };
    dispatch({ type: 'ADD_ITEM', payload: { item } });
  }

  function updateQty(lineId: string, qty: number) {
    dispatch({ type: 'UPDATE_QTY', payload: { lineId, qty } });
  }

  function adjustQty(lineId: string, delta: number) {
    dispatch({ type: 'ADJUST_QTY', payload: { lineId, delta } });
  }

  function removeItem(lineId: string) {
    dispatch({ type: 'REMOVE_ITEM', payload: { lineId } });
  }

  function clearCart() {
    dispatch({ type: 'CLEAR_CART' });
  }

  function openDrawer() {
    dispatch({ type: 'OPEN_DRAWER' });
  }

  function closeDrawer() {
    dispatch({ type: 'CLOSE_DRAWER' });
  }

  return {
    items: state.items,
    isDrawerOpen: state.isDrawerOpen,
    totals,
    validation,
    removedNotice,
    dismissRemovedNotice,
    addItem,
    updateQty,
    adjustQty,
    removeItem,
    clearCart,
    openDrawer,
    closeDrawer,
  };
}
