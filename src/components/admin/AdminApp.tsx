import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Product } from '../../types/product';
import type { SiteSettings } from '../../types/settings';
import type { Supplier } from '../../types/supplier';
import type { Client, ClientPayload, ClientWithStats, SalesConfig, StaffRole } from '../../types/sales';
import { catalog, fetchCatalogProducts, loadCatalog, saveCatalog } from '../../data/catalog';
import { settings, saveSettings } from '../../data/settings';
import { ApiError } from '../../data/apiClient';
import { fetchSuppliers } from '../../data/suppliers';
import { createClient, fetchClients, fetchSalesConfig } from '../../data/sales';
import { mergeCatalog } from '../../utils/catalogMerge';
import { AdminSalesManager } from './AdminSalesManager';
import { AdminReports } from './AdminReports';
import { AdminClientsManager } from './AdminClientsManager';
import { AdminSalesSettings } from './AdminSalesSettings';
import { AdminStockManager } from './AdminStockManager';
import { AdminProductTable } from './AdminProductTable';
import { AdminProductForm } from './AdminProductForm';
import { AdminSettingsForm } from './AdminSettingsForm';
import { AdminSuppliersManager } from './AdminSuppliersManager';
import { AdminLoginScreen } from './AdminLoginScreen';
import { ExportJsonButton } from './ExportJsonButton';
import { AdminSessionContext, type AdminSession } from './adminSession';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';

const ADMIN_PASSWORD_KEY = 'catalogo:adminPassword';
const ADMIN_ROLE_KEY = 'catalogo:adminRole';

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

type Tab = 'sales' | 'reports' | 'clients' | 'stock' | 'products' | 'suppliers' | 'settings';
type Feedback = { tone: 'success' | 'error'; text: string } | null;

const TAB_LABELS: Record<Tab, string> = {
  sales: 'Ventas',
  reports: 'Reportes',
  clients: 'Clientas',
  stock: 'Stock',
  products: 'Productos',
  suppliers: 'Proveedores',
  settings: 'Configuración',
};

/** Las vendedoras ven solo lo necesario para vender: sin costos, reportes ni catálogo. */
const TABS_BY_ROLE: Record<StaffRole, Tab[]> = {
  admin: ['sales', 'reports', 'clients', 'stock', 'products', 'suppliers', 'settings'],
  seller: ['sales', 'clients'],
};

function readStoredRole(): StaffRole {
  return sessionStorage.getItem(ADMIN_ROLE_KEY) === 'seller' ? 'seller' : 'admin';
}

export function AdminApp() {
  const [adminPassword, setAdminPassword] = useState<string | null>(() => sessionStorage.getItem(ADMIN_PASSWORD_KEY));
  const [role, setRole] = useState<StaffRole>(readStoredRole);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>('sales');
  const [settingsSection, setSettingsSection] = useState<'site' | 'sales'>('site');

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

  /** Igual con clientas y configuración de ventas: las usan Ventas, Clientas y Configuración. */
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [isLoadingClients, setLoadingClients] = useState(true);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [salesConfig, setSalesConfig] = useState<SalesConfig | null>(null);
  const [salesConfigError, setSalesConfigError] = useState<string | null>(null);

  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => clone(settings));
  const [isSavingSettings, setSavingSettings] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<Feedback>(null);

  const hasUnpublishedChanges = useMemo(
    () => JSON.stringify(products) !== publishedSnapshot,
    [products, publishedSnapshot],
  );

  /** La contraseña dejó de servir (cambió en el servidor o venía guardada de antes). */
  const handleAuthError = useCallback(() => {
    sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
    sessionStorage.removeItem(ADMIN_ROLE_KEY);
    setAdminPassword(null);
    setLoginError('Tu sesión ya no es válida. Ingresá la contraseña de nuevo.');
  }, []);

  const session = useMemo<AdminSession | null>(
    () => (adminPassword ? { password: adminPassword, role, onAuthError: handleAuthError } : null),
    [adminPassword, role, handleAuthError],
  );

  function messageFor(err: unknown, fallback: string): string | null {
    if (err instanceof ApiError && err.status === 401) {
      handleAuthError();
      return null;
    }
    return err instanceof ApiError ? err.userMessage : fallback;
  }

  /**
   * Ningún `setState` corre de forma sincrónica en estas cargas: todos quedan después del `await`,
   * para que llamarlas desde un efecto no dispare un render en cascada.
   */
  const loadSuppliers = useCallback(async () => {
    if (!adminPassword || role !== 'admin') return;
    try {
      const list = await fetchSuppliers(adminPassword);
      setSuppliers(list);
      setSuppliersError(null);
    } catch (err) {
      setSuppliersError(err instanceof ApiError ? err.userMessage : 'No se pudieron cargar los proveedores.');
    } finally {
      setLoadingSuppliers(false);
    }
  }, [adminPassword, role]);

  const loadClients = useCallback(async () => {
    if (!adminPassword) return;
    try {
      setClients(await fetchClients(adminPassword));
      setClientsError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleAuthError();
        return;
      }
      setClientsError(err instanceof ApiError ? err.userMessage : 'No se pudieron cargar las clientas.');
    } finally {
      setLoadingClients(false);
    }
  }, [adminPassword, handleAuthError]);

  const loadSalesConfig = useCallback(async () => {
    if (!adminPassword) return;
    try {
      setSalesConfig(await fetchSalesConfig(adminPassword));
      setSalesConfigError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleAuthError();
        return;
      }
      setSalesConfigError(err instanceof ApiError ? err.userMessage : 'No se pudo cargar la configuración de ventas.');
    }
  }, [adminPassword, handleAuthError]);

  useEffect(() => {
    // La regla no puede ver dentro de las funciones async: acá no hay ningún setState sincrónico,
    // todos ocurren después del await de la red, que es justamente el caso que la regla permite.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSuppliers();
    void loadClients();
    void loadSalesConfig();
  }, [loadSuppliers, loadClients, loadSalesConfig]);

  /** Reintento manual: acá sí conviene volver a mostrar el estado de carga. */
  function reloadSuppliers() {
    setLoadingSuppliers(true);
    void loadSuppliers();
  }

  function reloadClients() {
    void loadClients();
  }

  async function handleCreateClient(payload: ClientPayload): Promise<Client> {
    const client = await createClient(payload, adminPassword!);
    // Se agrega al instante para que el selector la muestre ya elegida, y después se refresca.
    setClients((prev) => [
      ...prev,
      { ...client, stats: { salesCount: 0, revenue: 0, units: 0, firstDate: null, lastDate: null, balance: 0, pendingDeliveries: 0 } },
    ]);
    return client;
  }

  function handleLoginSuccess(password: string, nextRole: StaffRole) {
    sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
    sessionStorage.setItem(ADMIN_ROLE_KEY, nextRole);
    setAdminPassword(password);
    setRole(nextRole);
    setTab('sales');
    setLoginError(null);
  }

  function handleLogout() {
    sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
    sessionStorage.removeItem(ADMIN_ROLE_KEY);
    setAdminPassword(null);
    setLoginError(null);
  }

  if (!adminPassword || !session) {
    return <AdminLoginScreen onSuccess={handleLoginSuccess} initialError={loginError} />;
  }

  const visibleTabs = TABS_BY_ROLE[role];
  const activeTab = visibleTabs.includes(tab) ? tab : 'sales';
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
      // Antes de publicar se trae el catálogo actual: si mientras tanto se registraron ventas, se
      // respetan sus descuentos de stock en vez de pisarlos con la copia vieja del panel.
      const remote = await fetchCatalogProducts();
      const merged = mergeCatalog(JSON.parse(publishedSnapshot) as Product[], products, remote);
      await saveCatalog(merged, adminPassword!);
      const fresh = clone(catalog.products);
      setProducts(fresh);
      setPublishedSnapshot(JSON.stringify(fresh));
      setPublishFeedback({ tone: 'success', text: 'Publicado — ya lo ven tus clientas.' });
    } catch (err) {
      const message = messageFor(err, 'No se pudo publicar.');
      if (message) setPublishFeedback({ tone: 'error', text: message });
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
      const message = messageFor(err, 'No se pudo publicar la configuración.');
      if (message) setSettingsFeedback({ tone: 'error', text: message });
    } finally {
      setSavingSettings(false);
    }
  }

  /**
   * Tras una venta el stock cambió del lado del servidor: se vuelve a bajar el catálogo. Si había
   * cambios sin publicar en Stock o Productos, se conservan (se unen con lo nuevo del servidor).
   */
  async function refreshAfterSale() {
    const base = JSON.parse(publishedSnapshot) as Product[];
    await loadCatalog();
    const fresh = clone(catalog.products);
    setProducts((current) => (JSON.stringify(current) === JSON.stringify(base) ? fresh : mergeCatalog(base, current, fresh)));
    setPublishedSnapshot(JSON.stringify(fresh));
  }

  // En Ventas no se muestra la barra: ahí cada acción impacta al instante en el servidor.
  const showPublishBar = activeTab === 'stock' || activeTab === 'products';

  return (
    <AdminSessionContext.Provider value={session}>
      <div className="mx-auto max-w-4xl px-4 pb-28 pt-5 sm:px-6 sm:pb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-heading text-lg font-bold text-stone-900">
            {role === 'admin' ? 'Panel de administración' : 'Panel de ventas'}
          </h1>
          <div className="flex items-center gap-3">
            <a
              href="#/"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              ← Ver el catálogo
            </a>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-sm font-semibold text-stone-600 hover:text-stone-900"
            >
              Salir
            </button>
          </div>
        </div>

        {/* overflow-y-hidden: el -mb-px de cada pestaña desborda 1px y, sin esto, aparece una barra vertical. */}
        <div className="mb-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-stone-200" role="tablist">
          {visibleTabs.map((t) => (
            <TabButton key={t} isActive={activeTab === t} onClick={() => setTab(t)}>
              {TAB_LABELS[t]}
            </TabButton>
          ))}
        </div>

        {salesConfigError && (activeTab === 'sales' || activeTab === 'settings') && (
          <Alert tone="error" className="mb-4" onRetry={() => void loadSalesConfig()}>
            {salesConfigError}
          </Alert>
        )}

        {activeTab === 'sales' &&
          (salesConfig ? (
            <AdminSalesManager
              products={products}
              clients={clients}
              config={salesConfig}
              onCreateClient={handleCreateClient}
              onClientsChanged={reloadClients}
              onStockChanged={() => void refreshAfterSale()}
            />
          ) : (
            !salesConfigError && <p className="py-10 text-center text-sm text-stone-600">Cargando…</p>
          ))}

        {activeTab === 'reports' && <AdminReports />}

        {activeTab === 'clients' && (
          <AdminClientsManager
            clients={clients}
            isLoading={isLoadingClients}
            loadError={clientsError}
            onReload={reloadClients}
            onCreateClient={handleCreateClient}
          />
        )}

        {activeTab === 'stock' && <AdminStockManager products={products} onChange={setProducts} suppliers={suppliers} />}

        {activeTab === 'products' && (
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

        {activeTab === 'suppliers' && (
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

        {activeTab === 'settings' && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Sección de configuración">
                <Chip isActive={settingsSection === 'site'} onClick={() => setSettingsSection('site')}>
                  Sitio y catálogo
                </Chip>
                <Chip isActive={settingsSection === 'sales'} onClick={() => setSettingsSection('sales')}>
                  Ventas
                </Chip>
              </div>
              {settingsSection === 'site' && (
                <ExportJsonButton data={siteSettings} filename="settings.json" label="Descargar backup" />
              )}
            </div>

            {settingsSection === 'site' ? (
              <>
                {settingsFeedback && (
                  <Alert tone={settingsFeedback.tone} className="mb-4">
                    {settingsFeedback.text}
                  </Alert>
                )}
                <AdminSettingsForm
                  settings={siteSettings}
                  adminPassword={adminPassword}
                  onSave={handlePublishSettings}
                  saveLabel={isSavingSettings ? 'Publicando…' : 'Publicar cambios'}
                />
              </>
            ) : (
              salesConfig && <AdminSalesSettings config={salesConfig} products={products} onSaved={setSalesConfig} />
            )}
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
    </AdminSessionContext.Provider>
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
