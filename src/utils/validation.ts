import type { CartLineItem } from '../types/cart';
import type { Product } from '../types/product';

export interface CartValidationResult {
  lineIssues: { lineId: string; message: string }[];
  productIssues: { productId: string; message: string }[];
  /** Todos los avisos combinados — para mostrar y para embeber en el mensaje de WhatsApp. */
  allMessages: string[];
  /** Informativo: estos avisos nunca bloquean el botón de WhatsApp. El mínimo de pedido
   * (cantidad/monto total) es un requisito aparte — ver `utils/orderMinimum.ts`. */
  isValid: boolean;
}

export function validateCart(items: CartLineItem[], products: Product[]): CartValidationResult {
  const lineIssues = items
    .filter((item) => item.qty < item.minQtyPerVariant)
    .map((item) => ({
      lineId: item.lineId,
      message: `${item.productName} (Talle ${item.size} / ${item.color}): mínimo ${item.minQtyPerVariant} unidades, tenés ${item.qty}.`,
    }));

  const linesByProduct = new Map<string, CartLineItem[]>();
  for (const item of items) {
    const group = linesByProduct.get(item.productId) ?? [];
    group.push(item);
    linesByProduct.set(item.productId, group);
  }

  const productIssues: { productId: string; message: string }[] = [];
  for (const [productId, lines] of linesByProduct) {
    const product = products.find((p) => p.id === productId);
    if (!product?.minQtyPerProduct) continue;
    const totalQty = lines.reduce((sum, line) => sum + line.qty, 0);
    if (totalQty < product.minQtyPerProduct) {
      productIssues.push({
        productId,
        message: `${product.name}: mínimo ${product.minQtyPerProduct} unidades combinando talles/colores, tenés ${totalQty}.`,
      });
    }
  }

  const allMessages = [...lineIssues.map((i) => i.message), ...productIssues.map((i) => i.message)];

  return { lineIssues, productIssues, allMessages, isValid: allMessages.length === 0 };
}
