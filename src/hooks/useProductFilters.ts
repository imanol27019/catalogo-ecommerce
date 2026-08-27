import { useEffect, useMemo, useState } from 'react';
import type { Product, StockStatus } from '../types/product';
import { computeFacets, DEFAULT_FILTERS, matchesAllFilters } from '../utils/filters';
import type { FilterState } from '../utils/filters';
import { SYNC_FILTERS_TO_URL } from '../config/site.config';

function parseFiltersFromUrl(): FilterState {
  const params = new URLSearchParams(window.location.search);
  const list = (key: string) => params.get(key)?.split(',').filter(Boolean) ?? [];
  const num = (key: string) => {
    const raw = params.get(key);
    return raw ? Number(raw) : undefined;
  };
  return {
    search: params.get('q') ?? '',
    categories: list('cat'),
    sizes: list('talle'),
    colors: list('color'),
    priceMin: num('min'),
    priceMax: num('max'),
    stockStatuses: list('stock') as StockStatus[],
  };
}

function syncFiltersToUrl(filters: FilterState) {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('q', filters.search.trim());
  if (filters.categories.length) params.set('cat', filters.categories.join(','));
  if (filters.sizes.length) params.set('talle', filters.sizes.join(','));
  if (filters.colors.length) params.set('color', filters.colors.join(','));
  if (filters.priceMin != null) params.set('min', String(filters.priceMin));
  if (filters.priceMax != null) params.set('max', String(filters.priceMax));
  if (filters.stockStatuses.length) params.set('stock', filters.stockStatuses.join(','));

  const query = params.toString();
  const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', newUrl);
}

export function useProductFilters(products: Product[]) {
  const [filters, setFilters] = useState<FilterState>(() =>
    SYNC_FILTERS_TO_URL ? parseFiltersFromUrl() : DEFAULT_FILTERS,
  );

  const facets = useMemo(() => computeFacets(products), [products]);
  const filteredProducts = useMemo(
    () => products.filter((p) => matchesAllFilters(p, filters)),
    [products, filters],
  );

  useEffect(() => {
    if (SYNC_FILTERS_TO_URL) syncFiltersToUrl(filters);
  }, [filters]);

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  return { filters, setFilters, facets, filteredProducts, resetFilters };
}
