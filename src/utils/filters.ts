import type { Product, StockStatus } from '../types/product';
import { CATEGORY_ORDER } from '../config/site.config';

export interface FilterState {
  search: string;
  categories: string[];
  sizes: string[];
  colors: string[];
  priceMin?: number;
  priceMax?: number;
  stockStatuses: StockStatus[];
}

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  categories: [],
  sizes: [],
  colors: [],
  priceMin: undefined,
  priceMax: undefined,
  stockStatuses: [],
};

export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.categories.length > 0 ||
    filters.sizes.length > 0 ||
    filters.colors.length > 0 ||
    filters.priceMin != null ||
    filters.priceMax != null ||
    filters.stockStatuses.length > 0
  );
}

const DIACRITICS_REGEX = new RegExp('[\\u0300-\\u036f]', 'g');

function normalize(value: string): string {
  return value.normalize('NFD').replace(DIACRITICS_REGEX, '').toLowerCase();
}

function matchesSearch(product: Product, search: string): boolean {
  if (!search.trim()) return true;
  const needle = normalize(search.trim());
  const haystack = normalize([product.name, product.description, ...(product.tags ?? [])].join(' '));
  return haystack.includes(needle);
}

function matchesCategory(product: Product, categories: string[]): boolean {
  return categories.length === 0 || categories.includes(product.category);
}

function matchesSize(product: Product, sizes: string[]): boolean {
  return sizes.length === 0 || sizes.some((size) => product.sizes.includes(size));
}

function matchesColor(product: Product, colors: string[]): boolean {
  return colors.length === 0 || colors.some((color) => product.colors.some((c) => c.name === color));
}

function matchesPrice(product: Product, min?: number, max?: number): boolean {
  if (min != null && product.unitPrice < min) return false;
  if (max != null && product.unitPrice > max) return false;
  return true;
}

function matchesStock(product: Product, statuses: StockStatus[]): boolean {
  if (statuses.length === 0) return true;
  return product.variants.some((v) => statuses.includes(v.stockStatus));
}

export function matchesAllFilters(product: Product, filters: FilterState): boolean {
  return (
    product.status === 'active' &&
    matchesSearch(product, filters.search) &&
    matchesCategory(product, filters.categories) &&
    matchesSize(product, filters.sizes) &&
    matchesColor(product, filters.colors) &&
    matchesPrice(product, filters.priceMin, filters.priceMax) &&
    matchesStock(product, filters.stockStatuses)
  );
}

const LETTER_SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export function sortSizes(sizes: Iterable<string>): string[] {
  const unique = [...new Set(sizes)];
  const letters = unique
    .filter((s) => LETTER_SIZE_ORDER.includes(s.toUpperCase()))
    .sort((a, b) => LETTER_SIZE_ORDER.indexOf(a.toUpperCase()) - LETTER_SIZE_ORDER.indexOf(b.toUpperCase()));
  const numbers = unique
    .filter((s) => !LETTER_SIZE_ORDER.includes(s.toUpperCase()))
    .sort((a, b) => Number(a) - Number(b));
  return [...letters, ...numbers];
}

export interface Facets {
  categories: string[];
  sizes: string[];
  colors: { name: string; hex: string }[];
  priceMin: number;
  priceMax: number;
}

export function computeFacets(products: Product[]): Facets {
  const categories = new Set<string>();
  const sizes = new Set<string>();
  const colors = new Map<string, string>();
  let priceMin = Infinity;
  let priceMax = 0;

  for (const product of products) {
    if (product.status !== 'active') continue;
    categories.add(product.category);
    for (const size of product.sizes) sizes.add(size);
    for (const color of product.colors) colors.set(color.name, color.hex);
    priceMin = Math.min(priceMin, product.unitPrice);
    priceMax = Math.max(priceMax, product.unitPrice);
  }

  const categoryList = [...categories].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b);
  });

  return {
    categories: categoryList,
    sizes: sortSizes(sizes),
    colors: [...colors.entries()].map(([name, hex]) => ({ name, hex })),
    priceMin: priceMin === Infinity ? 0 : priceMin,
    priceMax,
  };
}
