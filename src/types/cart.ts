import type { BulkPriceTier } from './product';

export interface CartLineItem {
  /** `${productId}__${size}__${color}` — stable key for one talle/color line. */
  lineId: string;
  productId: string;
  /** Variante exacta (talle+color); la necesita el servidor para descontar stock al vender. */
  variantId: string;
  productName: string;
  productSlug: string;
  image: string;
  size: string;
  color: string;
  colorHex: string;
  /** Snapshot at add-time so the cart stays stable if the catalog changes mid-session. */
  unitPrice: number;
  bulkPricing?: BulkPriceTier[];
  minQtyPerVariant: number;
  qty: number;
}

export interface CartState {
  items: CartLineItem[];
  /** Ephemeral UI state — never persisted to localStorage. */
  isDrawerOpen: boolean;
}

export type CartAction =
  | { type: 'ADD_ITEM'; payload: { item: CartLineItem } }
  | { type: 'UPDATE_QTY'; payload: { lineId: string; qty: number } }
  | { type: 'ADJUST_QTY'; payload: { lineId: string; delta: number } }
  | { type: 'REMOVE_ITEM'; payload: { lineId: string } }
  | { type: 'CLEAR_CART' }
  | { type: 'OPEN_DRAWER' }
  | { type: 'CLOSE_DRAWER' }
  | { type: 'HYDRATE'; payload: { items: CartLineItem[] } }
  | {
      type: 'RECONCILE_WITH_CATALOG';
      payload: { items: CartLineItem[]; removedNames: string[] };
    };

export interface CartTotals {
  itemCount: number;
  subtotal: number;
  grandTotal: number;
}
