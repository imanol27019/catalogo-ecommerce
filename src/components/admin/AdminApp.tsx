import { useState } from 'react';
import type { Product } from '../../types/product';
import type { SiteSettings } from '../../types/settings';
import { catalog, saveCatalog } from '../../data/catalog';
import { settings, saveSettings } from '../../data/settings';
import { ApiError } from '../../data/apiClient';
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

type Tab = 'products' | 'settings';

export function AdminApp() {
  const [adminPassword, setAdminPassword] = useState<string | null>(() => sessionStorage.getItem(ADMIN_PASSWORD_KEY));
  const [loginError, setLoginError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>('products');

  const [products, setProducts] = useState<Product[]>(() => clone(catalog.products));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSavingProducts, setSavingProducts] = useState(false);
  const [productsSaveMessage, setProductsSaveMessage] = useState<string | null>(null);

  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => clone(settings));
  const [isSavingSettings, setSavingSettings] = useState(false);
  const [settingsSaveMessage, setSettingsSaveMessage] = useState<string | null>(null);

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
    if (!window.confirm('¿Quitar este producto? Se aplica recién cuando lo publiques.')) return;
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  function handleCreateProduct() {
    const blank = createBlankProduct();
    setProducts((prev) => [...prev, blank]);
    setEditingId(blank.id);
  }

  async function handlePublishProducts() {
    setSavingProducts(true);
    setProductsSaveMessage(null);
    try {
      await saveCatalog(products, adminPassword!);
      setProductsSaveMessage('Publicado — ya está visible para todas las visitantes.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleAuthError();
      } else {
        setProductsSaveMessage('No se pudo publicar. Revisá que el servidor esté corriendo.');
      }
    } finally {
      setSavingProducts(false);
    }
  }

  async function handlePublishSettings(updated: SiteSettings) {
    setSiteSettings(updated);
    setSavingSettings(true);
    setSettingsSaveMessage(null);
    try {
      await saveSettings(updated, adminPassword!);
      setSettingsSaveMessage('Publicado — ya está visible para todas las visitantes.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleAuthError();
      } else {
        setSettingsSaveMessage('No se pudo publicar. Revisá que el servidor esté corriendo.');
      }
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-stone-900">Panel de administración</h1>
          <p className="text-sm text-stone-500">Los cambios se publican al servidor al instante</p>
        </div>
        <a href="#/" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
          ← Volver al catálogo
        </a>
      </div>

      <div className="mb-6 flex gap-2 border-b border-stone-200">
        <TabButton isActive={tab === 'products'} onClick={() => setTab('products')}>
          Productos
        </TabButton>
        <TabButton isActive={tab === 'settings'} onClick={() => setTab('settings')}>
          Configuración
        </TabButton>
      </div>

      {tab === 'products' ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" onClick={handleCreateProduct}>
              + Nuevo producto
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              {productsSaveMessage && <p className="text-sm font-medium text-stone-600">{productsSaveMessage}</p>}
              <ExportJsonButton
                data={{ updatedAt: new Date().toISOString(), products }}
                filename="products.json"
                label="Exportar backup (JSON)"
              />
              <Button onClick={handlePublishProducts} disabled={isSavingProducts}>
                {isSavingProducts ? 'Publicando…' : 'Publicar cambios'}
              </Button>
            </div>
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
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
            {settingsSaveMessage && <p className="text-sm font-medium text-stone-600">{settingsSaveMessage}</p>}
            <ExportJsonButton data={siteSettings} filename="settings.json" label="Exportar backup (JSON)" />
          </div>
          <AdminSettingsForm settings={siteSettings} onSave={handlePublishSettings} saveLabel={isSavingSettings ? 'Publicando…' : 'Publicar cambios'} />
        </>
      )}
    </div>
  );
}

function TabButton({ isActive, onClick, children }: { isActive: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 font-heading text-sm font-medium transition-colors ${
        isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-800'
      }`}
    >
      {children}
    </button>
  );
}
