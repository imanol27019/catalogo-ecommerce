import { useState } from 'react';
import { catalog } from './data/catalog';
import { AnnouncementBar } from './components/layout/AnnouncementBar';
import { Header } from './components/layout/Header';
import { HeroBanner } from './components/layout/HeroBanner';
import { FaqSection } from './components/layout/FaqSection';
import { Footer } from './components/layout/Footer';
import { FloatingCartButton } from './components/layout/FloatingCartButton';
import { WhatsAppContactButton } from './components/layout/WhatsAppContactButton';
import { CategoryNav } from './components/catalog/CategoryNav';
import { FeaturedProducts } from './components/catalog/FeaturedProducts';
import { FiltersBar } from './components/catalog/FiltersBar';
import { ProductGrid } from './components/catalog/ProductGrid';
import { ProductModal } from './components/product/ProductModal';
import { CartDrawer } from './components/cart/CartDrawer';
import { useProductFilters } from './hooks/useProductFilters';
import type { Product } from './types/product';

export function Storefront() {
  const { filters, setFilters, facets, filteredProducts, resetFilters } = useProductFilters(catalog.products);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  function selectCategory(category: string) {
    setFilters((f) => ({ ...f, categories: [category] }));
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AnnouncementBar />
      <Header />
      <HeroBanner />
      <FeaturedProducts products={catalog.products} onSelectProduct={setSelectedProduct} />
      <CategoryNav categories={facets.categories} activeCategories={filters.categories} onSelect={selectCategory} />

      <main id="catalogo" className="mx-auto w-full max-w-6xl flex-1 scroll-mt-16 px-4 py-8 sm:px-6">
        <div className="mb-6">
          <FiltersBar
            filters={filters}
            facets={facets}
            resultCount={filteredProducts.length}
            onChange={setFilters}
            onReset={resetFilters}
          />
        </div>

        <ProductGrid products={filteredProducts} onSelectProduct={setSelectedProduct} onClearFilters={resetFilters} />
      </main>

      <FaqSection />
      <Footer categories={facets.categories} onSelectCategory={selectCategory} />
      <FloatingCartButton />
      <WhatsAppContactButton />
      <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      <CartDrawer />
    </div>
  );
}
