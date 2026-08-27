import { createContext } from 'react';
import type { Dispatch } from 'react';
import type { CartAction, CartState } from '../types/cart';

export interface CartContextValue {
  state: CartState;
  dispatch: Dispatch<CartAction>;
  removedNotice: string[] | null;
  dismissRemovedNotice: () => void;
}

export const CartContext = createContext<CartContextValue | null>(null);
