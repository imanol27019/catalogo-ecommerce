import { useMemo, useState } from 'react';
import type { Product } from '../../types/product';
import type { SiteSettings } from '../../types/settings';
import { catalog, saveCatalog } from '../../data/catalog';
import { settings, saveSettings } from '../../data/settings';
import { ApiError } from '../../data/apiClient';
import { AdminStockManager } from './AdminStockManager';
import { AdminProductTable } from './AdminProductTable';
import { AdminProductForm } from './AdminProductForm';
import { AdminSettingsForm } from './AdminSettingsForm';
import { AdminLoginScreen } from './AdminLoginScreen';
import { ExportJsonButton } from './ExportJsonButton';
import { Button } from '../ui/Button';

const ADMIN_PASSWORD_KEY = 'catalogo:adminPassword';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createBlankProduct(): Product {
  const id = `nuevo-${Date.now()}`;
  return {
    id,
    slug: id,
    name: 'Nuevo producto',
    category: 'remeras',
    description: '',
    images: [],
    unitPrice: 0,
    minQtyPerVariant: 1,
    sizes: ['S', 'M', 'L'],
    colors: [{ name: 'Negro', hex: '#111111' }],
    variants: [
      { id: `${id}-S-negro`, size: 'S', color: 'Negro', colorHex: '#111111', stockStatus: 'in_stock' },
      { id: `${id}-M-negro`, size: 'M', color: 'Negro', colorHex: '#111111', stockStatus: 'in_stock' },
      { id: `${id}-L-negro`, size: 'L', color: 'Negro', colorHex: '#111111', stockStatus: 'in_stock' },
    ],
    status: 'active',
  };
}

type Tab = 'stock' | 'products' | 'settings';

export function AdminApp() {
  const [adminPassword, setAdminPassword] = useState<string | null>(() => sessionStorage.getItem(ADMIN_PASSWORD_KEY));
  const [loginError, setLoginError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>('stock');

  const [products, setProducts] = useState<Product[]>(() => clone(catalog.products));
  /** Última versión publicada, para saber si quedan cambios sin publicar. */
  const [publishedSnapshot, setPublishedSnapshot] = useState(() => JSON.stringify(catalog.products));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPublishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => clone(settings));
  const [isSavingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  const hasUnpublishedChanges = useMemo(
    () => JSON.stringify(products) !== publishedSnapshot,
    [products, publishedSnapshot],
  );

  function handleLogin(password: string) {
    sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
    setAdminPassword(password);
    setLoginError(null);
  }

  function handleAuthError() {
    sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
    setAdminPassword(null);
    setLoginError('Contraseña incorrecta. Volvé a ingresarla.');
  }

  if (!adminPassword) {
    return <AdminLoginScreen onSubmit={handleLogin} error={loginError} />;
  }

  const editingProduct = editingId ? (products.find((p) => p.id === editingId) ?? null) : null;

  function handleSaveProductDraft(updated: Product) {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === updated.id);
      return exists ? prev.map((p) => (p.id === updated.id ? updated : p)) : [...prev, updated];
    });
    setEditingId(null);
  }

  function handleDeleteProduct(id: string) {
    if (!window.confirm('¿Quitar este producto? Se aplica cuando publiques los cambios.')) return;
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  function handleCreateProduct() {
    const blank = createBlankProduct();
    setProducts((prev) => [...prev, blank]);
    setEditingId(blank.id);
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishMessage(null);
    try {
      await saveCatalog(products, adminPassword!);
      setPublishedSnapshot(JSON.stringify(products));
      setPublishMessage('Publicado — ya lo ven tus clientas.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleAuthError();
      } else {
        setPublishMessage('No se pudo publicar. Revisá tu conexión e intentá de nuevo.');
      }
    } finally {
      setPublishing(false);
    }
  }

  async function handlePublishSettings(updated: SiteSettings) {
    setSiteSettings(updated);
    setSavingSettings(true);
    setSettingsMessage(null);
    try {
      await saveSettings(updated, adminPassword!);
      setSettingsMessage('Publicado — ya lo ven tus clientas.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleAuthError();
      } else {
        setSettingsMessage('No se pudo publicar. Revisá tu conexión e intentá de nuevo.');
      }
    } finally {
      setSavingSettings(false);
    }
  }

  const showPublishBar = tab !== 'settings';

  return (
    <div className="mx-auto max-w-4xl px-4 pb-28 pt-5 sm:px-6 sm:pb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-lg font-bold text-stone-900">Panel de administración</h1>
        <a href="#/" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
          ← Ver el catálogo
        </a>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-stone-200">
        <TabButton isActive={tab === 'stock'} onClick={() => setTab('stock')}>
          Stock
        </TabButton>
        <TabButton isActive={tab === 'products'} onClick={() => setTab('products')}>
          Productos
        </TabButton>
        <TabButton isActive={tab === 'settings'} onClick={() => setTab('settings')}>
          Configuración
        </TabButton>
      </div>

      {tab === 'stock' && <AdminStockManager products={products} onChange={setProducts} />}

      {tab === 'products' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={handleCreateProduct}>
              + Nuevo producto
            </Button>
            <ExportJsonButton
              data={{ updatedAt: new Date().toISOString(), products }}
              filename="products.json"
              label="Descargar backup"
            />
          </div>

          {editingProduct ? (
            <AdminProductForm
              key={editingProduct.id}
              product={editingProduct}
              onSave={handleSaveProductDraft}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <AdminProductTable products={products} onEdit={setEditingId} onDelete={handleDeleteProduct} />
          )}
        </>
      )}

      {tab === 'settings' && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
            {settingsMessage && <p className="text-sm font-medium text-stone-600">{settingsMessage}</p>}
            <ExportJsonButton data={siteSettings} filename="settings.json" label="Descargar backup" />
          </div>
          <AdminSettingsForm
            settings={siteSettings}
            onSave={handlePublishSettings}
            saveLabel={isSavingSettings ? 'Publicando…' : 'Publicar cambios'}
          />
        </>
      )}

      {showPublishBar && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <p className="text-xs text-stone-500 sm:text-sm">
              {publishMessage ??
                (hasUnpublishedChanges ? 'Tenés cambios sin publicar.' : 'Todo publicado.')}
            </p>
            <Button onClick={handlePublish} disabled={isPublishing || !hasUnpublishedChanges}>
              {isPublishing ? 'Publicando…' : 'Publicar cambios'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ isActive, onClick, children }: { isActive: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px shrink-0 border-b-2 px-3 py-2 font-heading text-sm font-medium transition-colors ${
        isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-800'
      }`}
    >
      {children}
    </button>
  );
}
