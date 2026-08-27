export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface ProductVariant {
  id: string;
  size: string;
  color: string;
  colorHex: string;
  stockStatus: StockStatus;
  stockQty?: number;
  /** Overrides product.minQtyPerVariant for this exact talle/color, if set. */
  minQtyOverride?: number;
}

export interface BulkPriceTier {
  /** Once the line's quantity reaches this amount, `price` applies per unit. */
  minQty: number;
  price: number;
}

export interface ProductColor {
  name: string;
  hex: string;
}

export type ProductStatus = 'active' | 'draft' | 'archived';

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  images: string[];
  unitPrice: number;
  /** Precio de oferta opcional. Si está definido y es menor a unitPrice, se muestra como descuento. */
  salePrice?: number;
  bulkPricing?: BulkPriceTier[];
  minQtyPerVariant: number;
  minQtyPerProduct?: number;
  sizes: string[];
  colors: ProductColor[];
  /** Full sizes × colors matrix — every declared combination must appear, even out_of_stock. */
  variants: ProductVariant[];
  status: ProductStatus;
  /** Aparece en la sección de destacados/novedades de la portada. */
  featured?: boolean;
  tags?: string[];
  updatedAt?: string;
}

export interface ProductCatalog {
  updatedAt: string;
  products: Product[];
}
