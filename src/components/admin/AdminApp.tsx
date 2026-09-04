import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Product } from '../../types/product';
import type { SiteSettings } from '../../types/settings';
import type { Supplier } from '../../types/supplier';
import { catalog, loadCatalog, saveCatalog } from '../../data/catalog';
import { settings, saveSettings } from '../../data/settings';
import { ApiError } from '../../data/apiClient';
import { fetchSuppliers } from '../../data/suppliers';
import { AdminSalesManager } from './AdminSalesManager';
import { AdminStockManager } from './AdminStockManager';
import { AdminProductTable } from './AdminProductTable';
import { AdminProductForm } from './AdminProductForm';
import { AdminSettingsForm } from './AdminSettingsForm';
import { AdminSuppliersManager } from './AdminSuppliersManager';
import { AdminLoginScreen } from './AdminLoginScreen';
import { ExportJsonButton } from './ExportJsonButton';
import { Alert } from '../ui/Alert';
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
      { id: `${id}-S-negro`, size: 'S', color: 'Negro', colorHex: '#111111', stockQty: 0, stockStatus: 'out_of_stock' },
      { id: `${id}-M-negro`, size: 'M', color: 'Negro', colorHex: '#111111', stockQty: 0, stockStatus: 'out_of_stock' },
      { id: `${id}-L-negro`, size: 'L', color: 'Negro', colorHex: '#111111', stockQty: 0, stockStatus: 'out_of_stock' },
    ],
    status: 'active',
  };
}

type Tab = 'sales' | 'stock' | 'products' | 'suppliers' | 'settings';
type Feedback = { tone: 'success' | 'error'; text: string } | null;

export function AdminApp() {
  const [adminPassword, setAdminPassword] = useState<string | null>(() => sessionStorage.getItem(ADMIN_PASSWORD_KEY));
  const [loginError, setLoginError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>('sales');

  const [products, setProducts] = useState<Product[]>(() => clone(catalog.products));
  /** Última versión publicada, para saber si quedan cambios sin publicar. */
  const [publishedSnapshot, setPublishedSnapshot] = useState(() => JSON.stringify(catalog.products));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPublishing, setPublishing] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState<Feedback>(null);

  /**
   * Los proveedores se cargan acá y no dentro de su sección: la ficha de producto usa la misma
   * lista para el selector, y con dos cargas separadas quedaba desactualizada al agregar uno.
   */
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoadingSuppliers, setLoadingSuppliers] = useState(true);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);

  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => clone(settings));
  const [isSavingSettings, setSavingSettings] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<Feedback>(null);

  const hasUnpublishedChanges = useMemo(
    () => JSON.stringify(products) !== publishedSnapshot,
    [products, publishedSnapshot],
  );

  /**
   * Ningún `setState` corre de forma sincrónica acá: todos quedan después del `await`, para que
   * llamarla desde el efecto no dispare un render en cascada. El estado ya arranca en "cargando".
   */
  const loadSuppliers = useCallback(async () => {
    if (!adminPassword) return;
    try {
      const list = await fetchSuppliers(adminPassword);
      setSuppliers(list);
      setSuppliersError(null);
    } catch (err) {
      setSuppliersError(err instanceof ApiError ? err.userMessage : 'No se pudieron cargar los proveedores.');
    } finally {
      setLoadingSuppliers(false);
    }
  }, [adminPassword]);

  useEffect(() => {
    // La regla no puede ver dentro de la función async: acá no hay ningún setState sincrónico,
    // todos ocurren después del await de la red, que es justamente el caso que la regla permite.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSuppliers();
  }, [loadSuppliers]);

  /** Reintento manual: acá sí conviene volver a mostrar el estado de carga. */
  function reloadSuppliers() {
    setLoadingSuppliers(true);
    void loadSuppliers();
  }

  function handleLoginSuccess(password: string) {
    sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
    setAdminPassword(password);
    setLoginError(null);
  }

  /** La contraseña dejó de servir (cambió en el servidor o venía guardada de antes). */
  function handleAuthError() {
    sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
    setAdminPassword(null);
    setLoginError('Tu sesión ya no es válida. Ingresá la contraseña de nuevo.');
  }

  if (!adminPassword) {
    return <AdminLoginScreen onSuccess={handleLoginSuccess} initialError={loginError} />;
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
    setPublishFeedback(null);
    try {
      await saveCatalog(products, adminPassword!);
      setPublishedSnapshot(JSON.stringify(products));
      setPublishFeedback({ tone: 'success', text: 'Publicado — ya lo ven tus clientas.' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleAuthError();
        return;
      }
      setPublishFeedback({
        tone: 'error',
        text: err instanceof ApiError ? err.userMessage : 'No se pudo publicar.',
      });
    } finally {
      setPublishing(false);
    }
  }

  async function handlePublishSettings(updated: SiteSettings) {
    setSiteSettings(updated);
    setSavingSettings(true);
    setSettingsFeedback(null);
    try {
      await saveSettings(updated, adminPassword!);
      setSettingsFeedback({ tone: 'success', text: 'Publicado — ya lo ven tus clientas.' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleAuthError();
        return;
      }
      setSettingsFeedback({
        tone: 'error',
        text: err instanceof ApiError ? err.userMessage : 'No se pudo publicar la configuración.',
      });
    } finally {
      setSavingSettings(false);
    }
  }

  /**
   * Tras una venta el stock cambió del lado del servidor: se vuelve a bajar el catálogo para no
   * pisar ese descuento con la copia vieja que tenía abierta el panel.
   */
  async function refreshAfterSale() {
    await loadCatalog();
    const fresh = clone(catalog.products);
    setProducts(fresh);
    setPublishedSnapshot(JSON.stringify(fresh));
  }

  // En Ventas no se muestra la barra: ahí cada acción impacta al instante en el servidor.
  const showPublishBar = tab === 'stock' || tab === 'products';

  return (
    <div className="mx-auto max-w-4xl px-4 pb-28 pt-5 sm:px-6 sm:pb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-lg font-bold text-stone-900">Panel de administración</h1>
        <a
          href="#/"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          ← Ver el catálogo
        </a>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-stone-200" role="tablist">
        <TabButton isActive={tab === 'sales'} onClick={() => setTab('sales')}>
          Ventas
        </TabButton>
        <TabButton isActive={tab === 'stock'} onClick={() => setTab('stock')}>
          Stock
        </TabButton>
        <TabButton isActive={tab === 'products'} onClick={() => setTab('products')}>
          Productos
        </TabButton>
        <TabButton isActive={tab === 'suppliers'} onClick={() => setTab('suppliers')}>
          Proveedores
        </TabButton>
        <TabButton isActive={tab === 'settings'} onClick={() => setTab('settings')}>
          Configuración
        </TabButton>
      </div>

      {tab === 'sales' && (
        <AdminSalesManager
          products={products}
          adminPassword={adminPassword}
          onAuthError={handleAuthError}
          onStockChanged={refreshAfterSale}
        />
      )}

      {tab === 'stock' && <AdminStockManager products={products} onChange={setProducts} suppliers={suppliers} />}

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
              suppliers={suppliers}
              adminPassword={adminPassword}
              onSave={handleSaveProductDraft}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <AdminProductTable products={products} onEdit={setEditingId} onDelete={handleDeleteProduct} />
          )}
        </>
      )}

      {tab === 'suppliers' && (
        <AdminSuppliersManager
          products={products}
          suppliers={suppliers}
          isLoading={isLoadingSuppliers}
          loadError={suppliersError}
          onReload={reloadSuppliers}
          onSuppliersChange={setSuppliers}
          adminPassword={adminPassword}
          onAuthError={handleAuthError}
        />
      )}

      {tab === 'settings' && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
            <ExportJsonButton data={siteSettings} filename="settings.json" label="Descargar backup" />
          </div>
          {settingsFeedback && (
            <Alert tone={settingsFeedback.tone} className="mb-4">
              {settingsFeedback.text}
            </Alert>
          )}
          <AdminSettingsForm
            settings={siteSettings}
            onSave={handlePublishSettings}
            saveLabel={isSavingSettings ? 'Publicando…' : 'Publicar cambios'}
          />
        </>
      )}

      {showPublishBar && (
        // z-20: barra fija, por debajo del header (z-30) y de las capas modales (z-50).
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <p
              className={`text-xs sm:text-sm ${
                publishFeedback?.tone === 'error' ? 'font-medium text-red-700' : 'text-stone-600'
              }`}
              role={publishFeedback?.tone === 'error' ? 'alert' : 'status'}
            >
              {publishFeedback?.text ?? (hasUnpublishedChanges ? 'Tenés cambios sin publicar.' : 'Todo publicado.')}
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
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={`-mb-px min-h-11 shrink-0 border-b-2 px-3 font-heading text-sm font-medium transition-colors ${
        isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-stone-600 hover:text-stone-900'
      }`}
    >
      {children}
    </button>
  );
}
