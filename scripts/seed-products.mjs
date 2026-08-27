// Script de generación única de datos de demo (`src/data/products.json`).
// Uso: node scripts/seed-products.mjs
// Define productos de forma compacta y expande la matriz talle×color completa,
// incluyendo variantes sin stock (nunca se omiten combinaciones declaradas).

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'src', 'data', 'products.json');
const SERVER_SEED_PATH = path.join(__dirname, '..', 'server', 'src', 'seed-data', 'products.json');

const COLORS = {
  Negro: '#111111',
  Blanco: '#F5F5F4',
  'Gris Melange': '#9CA3AF',
  Gris: '#6B7280',
  Azul: '#2563EB',
  'Azul Marino': '#1E3A5F',
  'Verde Militar': '#4B5320',
  Bordo: '#7F1D1D',
  Beige: '#D8CAB8',
};

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Hash determinístico simple -> [0,1) para asignar stock de forma reproducible.
function seededFraction(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function stockForVariant(variantId) {
  const f = seededFraction(variantId);
  if (f < 0.12) return { stockStatus: 'out_of_stock', stockQty: 0 };
  if (f < 0.3) return { stockStatus: 'low_stock', stockQty: 2 + Math.floor(f * 10) };
  return { stockStatus: 'in_stock', stockQty: 15 + Math.floor(f * 60) };
}

/** @typedef {{ name: string, category: string, description: string, sizes: string[], colorNames: string[], unitPrice: number, salePrice?: number, minQtyPerVariant: number, minQtyPerProduct?: number, bulkPricing?: {minQty:number, price:number}[], featured?: boolean, tags?: string[] }} ProductSpec */

/** @type {ProductSpec[]} */
const SPECS = [
  // Remeras
  {
    name: 'Remera Básica Oversize',
    category: 'remeras',
    description: 'Remera de algodón peinado 24/1, corte oversize. Ideal para estampado.',
    sizes: ['S', 'M', 'L', 'XL'],
    colorNames: ['Negro', 'Blanco', 'Gris Melange'],
    unitPrice: 4500,
    minQtyPerVariant: 3,
    minQtyPerProduct: 12,
    bulkPricing: [{ minQty: 6, price: 3800 }],
    tags: ['basica', 'algodon', 'oversize'],
    featured: true,
  },
  {
    name: 'Remera Estampada Frase',
    category: 'remeras',
    description: 'Remera de algodón con estampa frontal, corte clásico.',
    sizes: ['S', 'M', 'L'],
    colorNames: ['Negro', 'Blanco'],
    unitPrice: 5200,
    salePrice: 3999,
    minQtyPerVariant: 3,
    tags: ['estampada'],
  },
  {
    name: 'Remera Deportiva Dry Fit',
    category: 'remeras',
    description: 'Tela dry fit transpirable, ideal para uso deportivo o urbano.',
    sizes: ['S', 'M', 'L', 'XL'],
    colorNames: ['Negro', 'Azul', 'Gris'],
    unitPrice: 4800,
    minQtyPerVariant: 3,
    bulkPricing: [{ minQty: 12, price: 4200 }],
    tags: ['deportiva', 'dry-fit'],
  },
  {
    name: 'Remera Cuello V Algodón',
    category: 'remeras',
    description: 'Remera cuello en V, algodón 100%, corte entallado.',
    sizes: ['S', 'M', 'L'],
    colorNames: ['Blanco', 'Negro', 'Bordo'],
    unitPrice: 4300,
    minQtyPerVariant: 3,
    tags: ['cuello-v'],
  },
  // Buzos
  {
    name: 'Buzo Canguro Frisa',
    category: 'buzos',
    description: 'Buzo canguro con capucha, frisa interior, bolsillo frontal.',
    sizes: ['S', 'M', 'L', 'XL'],
    colorNames: ['Negro', 'Gris Melange', 'Verde Militar'],
    unitPrice: 9800,
    minQtyPerVariant: 2,
    bulkPricing: [{ minQty: 6, price: 8600 }],
    tags: ['canguro', 'frisa'],
    featured: true,
  },
  {
    name: 'Buzo Cuello Redondo Rústico',
    category: 'buzos',
    description: 'Buzo cuello redondo, tela rústica, corte clásico.',
    sizes: ['S', 'M', 'L', 'XL'],
    colorNames: ['Negro', 'Bordo', 'Beige'],
    unitPrice: 8900,
    salePrice: 6900,
    minQtyPerVariant: 2,
    tags: ['rustico'],
  },
  {
    name: 'Buzo Oversize Frisa Perchada',
    category: 'buzos',
    description: 'Buzo oversize, frisa perchada premium, ideal para invierno.',
    sizes: ['M', 'L', 'XL'],
    colorNames: ['Negro', 'Gris', 'Blanco'],
    unitPrice: 10500,
    minQtyPerVariant: 2,
    minQtyPerProduct: 6,
    tags: ['oversize', 'premium'],
  },
  {
    name: 'Buzo Cierre Medio Zip',
    category: 'buzos',
    description: 'Buzo con cierre medio zip, cuello alto, frisa interior.',
    sizes: ['S', 'M', 'L'],
    colorNames: ['Azul Marino', 'Negro'],
    unitPrice: 11200,
    minQtyPerVariant: 2,
    tags: ['medio-zip'],
  },
  // Pantalones
  {
    name: 'Jogger Chupín Frisa',
    category: 'pantalones',
    description: 'Jogger chupín con puño, frisa interior, cintura elastizada.',
    sizes: ['38', '40', '42', '44'],
    colorNames: ['Negro', 'Gris', 'Azul'],
    unitPrice: 8600,
    minQtyPerVariant: 2,
    bulkPricing: [{ minQty: 6, price: 7500 }],
    tags: ['jogger', 'frisa'],
    featured: true,
  },
  {
    name: 'Pantalón Cargo Gabardina',
    category: 'pantalones',
    description: 'Pantalón cargo con bolsillos laterales, tela gabardina resistente.',
    sizes: ['38', '40', '42', '44'],
    colorNames: ['Verde Militar', 'Negro', 'Beige'],
    unitPrice: 10200,
    minQtyPerVariant: 2,
    tags: ['cargo', 'gabardina'],
  },
  {
    name: 'Jean Chupín Elastizado',
    category: 'pantalones',
    description: 'Jean chupín elastizado, tiro medio, alta durabilidad.',
    sizes: ['38', '40', '42', '44', '46'],
    colorNames: ['Azul', 'Negro'],
    unitPrice: 12500,
    minQtyPerVariant: 2,
    tags: ['jean'],
  },
  {
    name: 'Jogger Deportivo Piqué',
    category: 'pantalones',
    description: 'Jogger deportivo tela piqué liviana, puño en botamanga.',
    sizes: ['S', 'M', 'L', 'XL'],
    colorNames: ['Negro', 'Gris', 'Azul Marino'],
    unitPrice: 7800,
    minQtyPerVariant: 3,
    tags: ['deportivo'],
  },
  // Camperas
  {
    name: 'Campera Rompeviento',
    category: 'camperas',
    description: 'Campera rompeviento liviana, ideal para entretiempo.',
    sizes: ['S', 'M', 'L', 'XL'],
    colorNames: ['Negro', 'Azul', 'Gris'],
    unitPrice: 13500,
    minQtyPerVariant: 2,
    tags: ['rompeviento', 'entretiempo'],
  },
  {
    name: 'Campera Inflable Corta',
    category: 'camperas',
    description: 'Campera inflable corta, relleno térmico, cierre frontal.',
    sizes: ['S', 'M', 'L', 'XL'],
    colorNames: ['Negro', 'Verde Militar', 'Bordo'],
    unitPrice: 18900,
    minQtyPerVariant: 1,
    minQtyPerProduct: 4,
    tags: ['inflable', 'invierno'],
  },
  {
    name: 'Campera Jean Clásica',
    category: 'camperas',
    description: 'Campera de jean clásica, corte recto, botones metálicos.',
    sizes: ['S', 'M', 'L'],
    colorNames: ['Azul'],
    unitPrice: 15600,
    salePrice: 12900,
    minQtyPerVariant: 2,
    tags: ['jean'],
  },
  {
    name: 'Campera Bomber Frisa',
    category: 'camperas',
    description: 'Campera bomber con frisa interior, puños y cintura elastizados.',
    sizes: ['S', 'M', 'L', 'XL'],
    colorNames: ['Negro', 'Verde Militar'],
    unitPrice: 14200,
    minQtyPerVariant: 2,
    bulkPricing: [{ minQty: 4, price: 12800 }],
    featured: true,
    tags: ['bomber'],
  },
];

const products = SPECS.map((spec, index) => {
  const slug = slugify(spec.name);
  const id = `${spec.category.slice(0, 3)}-${String(index + 1).padStart(3, '0')}`;
  const colors = spec.colorNames.map((name) => ({ name, hex: COLORS[name] }));

  const variants = [];
  for (const size of spec.sizes) {
    for (const color of colors) {
      const variantId = `${id}-${size}-${slugify(color.name)}`;
      variants.push({
        id: variantId,
        size,
        color: color.name,
        colorHex: color.hex,
        ...stockForVariant(variantId),
      });
    }
  }

  return {
    id,
    slug,
    name: spec.name,
    category: spec.category,
    description: spec.description,
    images: [`/images/products/${slug}.svg`],
    unitPrice: spec.unitPrice,
    ...(spec.salePrice ? { salePrice: spec.salePrice } : {}),
    ...(spec.bulkPricing ? { bulkPricing: spec.bulkPricing } : {}),
    minQtyPerVariant: spec.minQtyPerVariant,
    ...(spec.minQtyPerProduct ? { minQtyPerProduct: spec.minQtyPerProduct } : {}),
    sizes: spec.sizes,
    colors,
    variants,
    status: 'active',
    ...(spec.featured ? { featured: true } : {}),
    ...(spec.tags ? { tags: spec.tags } : {}),
  };
});

const catalog = {
  updatedAt: new Date().toISOString(),
  products,
};

const json = JSON.stringify(catalog, null, 2) + '\n';
writeFileSync(OUT_PATH, json, 'utf-8');
try {
  writeFileSync(SERVER_SEED_PATH, json, 'utf-8');
} catch {
  // server/ puede no existir en algunos checkouts — no es un error fatal para este script.
}
console.log(`Escrito ${products.length} productos (${products.reduce((n, p) => n + p.variants.length, 0)} variantes) en ${OUT_PATH}`);
