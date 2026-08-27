import { useEffect, useMemo, useReducer, useState } from 'react';
import type { ReactNode } from 'react';
import type { CartLineItem, CartState } from '../types/cart';
import { cartReducer, reconcileCartItems } from './cartReducer';
import { CartContext } from './cartContextObject';
import { catalog } from '../data/catalog';

const CART_STORAGE_KEY = 'catalogo:cart:v1';

function loadInitialCart(): { state: CartState; removedNames: string[] } {
  let storedItems: CartLineItem[] = [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (raw) storedItems = JSON.parse(raw) as CartLineItem[];
  } catch {
    storedItems = [];
  }

  const { items, removedNames } = reconcileCartItems(storedItems, catalog.products);
  return { state: { items, isDrawerOpen: false }, removedNames };
}

export function CartProvider({ children }: { children: ReactNode }) {
  // Lazy init: el carrito persistido se lee y reconcilia en el primer render, no en un efecto
  // posterior — evita un segundo render y un "flash" de carrito vacío.
  const [initial] = useState(loadInitialCart);
  const [state, dispatch] = useReducer(cartReducer, initial.state);
  const [removedNotice, setRemovedNotice] = useState<string[] | null>(
    initial.removedNames.length > 0 ? initial.removedNames : null,
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.items));
      } catch {
        // localStorage puede fallar (modo privado, cuota llena) — el carrito sigue en memoria.
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [state.items]);

  const value = useMemo(
    () => ({ state, dispatch, removedNotice, dismissRemovedNotice: () => setRemovedNotice(null) }),
    [state, removedNotice],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
