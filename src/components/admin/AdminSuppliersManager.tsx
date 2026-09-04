import { useMemo, useState } from 'react';
import type { Product } from '../../types/product';
import type { Supplier } from '../../types/supplier';
import { saveSuppliers } from '../../data/suppliers';
import { ApiError } from '../../data/apiClient';
import { BUSINESS_NAME } from '../../config/site.config';
import { buildRestockMessage, buildSupplierWhatsAppUrl, normalizeWhatsapp } from '../../utils/supplier';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { INPUT_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS, TEXTAREA_CLASS } from '../ui/formStyles';

interface AdminSuppliersManagerProps {
  /** Los productos del panel, para mostrar qué le compra el negocio a cada proveedor. */
  products: Product[];
  /** La lista la carga AdminApp: el formulario de producto usa la misma y no puede quedar vieja. */
  suppliers: Supplier[];
  isLoading: boolean;
  loadError: string | null;
  onReload: () => void;
  /** Se llama con la lista ya guardada en el servidor. */
  onSuppliersChange: (next: Supplier[]) => void;
  adminPassword: string;
  onAuthError: () => void;
}

function createBlankSupplier(): Supplier {
  return { id: `prov-${Date.now()}`, name: '' };
}

function plural(n: number, singular: string, plural_: string): string {
  return `${n} ${n === 1 ? singular : plural_}`;
}

export function AdminSuppliersManager({
  products,
  suppliers,
  isLoading,
  loadError,
  onReload,
  onSuppliersChange,
  adminPassword,
  onAuthError,
}: AdminSuppliersManagerProps) {
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [isSaving, setSaving] = useState(false);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  const error = saveError ?? loadError;

  /** Qué productos tiene asignado cada proveedor. */
  const productsBySupplier = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const product of products) {
      if (!product.supplierId) continue;
      const list = map.get(product.supplierId) ?? [];
      list.push(product);
      map.set(product.supplierId, list);
    }
    return map;
  }, [products]);

  const sinProveedor = useMemo(() => products.filter((p) => !p.supplierId), [products]);

  async function persist(next: Supplier[], mensaje: string) {
    setSaving(true);
    setSaveError(null);
    setOkMessage(null);
    try {
      onSuppliersChange(await saveSuppliers(next, adminPassword));
      setEditing(null);
      setOkMessage(mensaje);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onAuthError();
        return;
      }
      setSaveError(err instanceof ApiError ? err.userMessage : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  function handleSave(draft: Supplier) {
    const limpio: Supplier = {
      ...draft,
      name: draft.name.trim(),
      contactName: draft.contactName?.trim() || undefined,
      whatsapp: draft.whatsapp ? normalizeWhatsapp(draft.whatsapp) : undefined,
      phone: draft.phone?.trim() || undefined,
      email: draft.email?.trim() || undefined,
      address: draft.address?.trim() || undefined,
      notes: draft.notes?.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    const existe = suppliers.some((s) => s.id === limpio.id);
    const next = existe ? suppliers.map((s) => (s.id === limpio.id ? limpio : s)) : [...suppliers, limpio];
    void persist(next, existe ? 'Proveedor actualizado.' : 'Proveedor agregado.');
  }

  function handleDelete(supplier: Supplier) {
    const vinculados = productsBySupplier.get(supplier.id) ?? [];
    const aviso =
      vinculados.length > 0
        ? `"${supplier.name}" tiene ${plural(vinculados.length, 'producto asignado', 'productos asignados')}. Si lo borrás, esos productos quedan sin proveedor. ¿Seguir?`
        : `¿Borrar a "${supplier.name}"?`;
    if (!window.confirm(aviso)) return;
    void persist(
      suppliers.filter((s) => s.id !== supplier.id),
      'Proveedor eliminado.',
    );
  }

  if (editing) {
    return (
      <SupplierForm
        supplier={editing}
        isSaving={isSaving}
        error={error}
        onCancel={() => {
          setEditing(null);
          setSaveError(null);
        }}
        onSave={handleSave}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info">
        Acá guardás a quién le comprás cada producto. Es información interna: no aparece en el catálogo. El
        proveedor de cada producto se elige en su ficha, dentro de la pestaña Productos.
      </Alert>

      <div className="flex justify-end">
        <Button onClick={() => setEditing(createBlankSupplier())}>+ Nuevo proveedor</Button>
      </div>

      {okMessage && <Alert tone="success">{okMessage}</Alert>}
      {error && (
        <Alert tone="error" onRetry={onReload}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <p className="py-10 text-center text-sm text-stone-600">Cargando proveedores…</p>
      ) : suppliers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 px-4 py-10 text-center">
          <p className="text-sm text-stone-600">Todavía no cargaste ningún proveedor.</p>
          <p className="mt-1 text-xs text-stone-600">
            Cargá uno y después asignáselo a tus productos desde la pestaña Productos.
          </p>
        </div>
      ) : (
        suppliers.map((supplier) => (
          <SupplierCard
            key={supplier.id}
            supplier={supplier}
            products={productsBySupplier.get(supplier.id) ?? []}
            onEdit={() => setEditing(supplier)}
            onDelete={() => handleDelete(supplier)}
          />
        ))
      )}

      {!isLoading && suppliers.length > 0 && sinProveedor.length > 0 && (
        <Alert tone="warning" title={`${plural(sinProveedor.length, 'producto', 'productos')} sin proveedor`}>
          {sinProveedor
            .slice(0, 6)
            .map((p) => p.name)
            .join(', ')}
          {sinProveedor.length > 6 ? ` y ${sinProveedor.length - 6} más.` : '.'}
        </Alert>
      )}
    </div>
  );
}

function SupplierCard({
  supplier,
  products,
  onEdit,
  onDelete,
}: {
  supplier: Supplier;
  products: Product[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const whatsappUrl = buildSupplierWhatsAppUrl(supplier, buildRestockMessage(BUSINESS_NAME, 'mercadería'));

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading text-base font-semibold text-stone-900">{supplier.name}</p>
          {supplier.contactName && <p className="text-sm text-stone-600">Contacto: {supplier.contactName}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700">
          {plural(products.length, 'producto', 'productos')}
        </span>
      </div>

      <div className="mt-3 flex flex-col text-sm">
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 font-semibold text-brand-700 hover:text-brand-800"
          >
            WhatsApp: {supplier.whatsapp}
          </a>
        )}
        {supplier.phone && (
          <a
            href={`tel:${supplier.phone}`}
            className="inline-flex min-h-11 items-center text-stone-700 hover:text-stone-900"
          >
            Teléfono: {supplier.phone}
          </a>
        )}
        {supplier.email && (
          <a
            href={`mailto:${supplier.email}`}
            className="inline-flex min-h-11 items-center break-all text-stone-700 hover:text-stone-900"
          >
            {supplier.email}
          </a>
        )}
        {supplier.address && <p className="py-1 text-stone-600">{supplier.address}</p>}
      </div>

      {supplier.notes && (
        <p className="mt-2 whitespace-pre-line rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700">
          {supplier.notes}
        </p>
      )}

      {products.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer py-2 text-xs font-semibold uppercase tracking-wide text-stone-600">
            Ver productos
          </summary>
          <ul className="mt-1 flex flex-col gap-1 text-sm text-stone-700">
            {products.map((p) => (
              <li key={p.id} className="truncate">
                · {p.name}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-4 flex gap-2 border-t border-stone-100 pt-3">
        <Button variant="secondary" className="flex-1" onClick={onEdit}>
          Editar
        </Button>
        <Button variant="danger" onClick={onDelete}>
          Eliminar
        </Button>
      </div>
    </div>
  );
}

function SupplierForm({
  supplier,
  isSaving,
  error,
  onCancel,
  onSave,
}: {
  supplier: Supplier;
  isSaving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (supplier: Supplier) => void;
}) {
  const [draft, setDraft] = useState<Supplier>(supplier);
  const [localError, setLocalError] = useState<string | null>(null);

  function update<K extends keyof Supplier>(key: K, value: Supplier[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.name.trim()) {
          setLocalError('Poné al menos el nombre del proveedor.');
          return;
        }
        setLocalError(null);
        onSave(draft);
      }}
      className="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-4"
    >
      <h2 className="font-heading text-base font-semibold text-stone-900">
        {supplier.name ? `Editar: ${supplier.name}` : 'Nuevo proveedor'}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Nombre del proveedor *</span>
          <input
            value={draft.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Ej: Showroom Flores"
            className={INPUT_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Persona de contacto</span>
          <input
            value={draft.contactName ?? ''}
            onChange={(e) => update('contactName', e.target.value)}
            placeholder="Ej: Marcela"
            className={INPUT_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>WhatsApp (formato 549…)</span>
          <input
            inputMode="numeric"
            value={draft.whatsapp ?? ''}
            onChange={(e) => update('whatsapp', e.target.value)}
            placeholder="5491122334455"
            className={INPUT_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Teléfono</span>
          <input value={draft.phone ?? ''} onChange={(e) => update('phone', e.target.value)} className={INPUT_CLASS} />
        </label>

        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Email</span>
          <input
            type="email"
            value={draft.email ?? ''}
            onChange={(e) => update('email', e.target.value)}
            className={INPUT_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Dirección</span>
          <input
            value={draft.address ?? ''}
            onChange={(e) => update('address', e.target.value)}
            placeholder="Ej: Av. Avellaneda 2100, local 12"
            className={INPUT_CLASS}
          />
        </label>

        <label className={`${LABEL_CLASS} sm:col-span-2`}>
          <span className={LABEL_TEXT_CLASS}>Notas (mínimos de compra, días de entrega, formas de pago…)</span>
          <textarea
            value={draft.notes ?? ''}
            onChange={(e) => update('notes', e.target.value)}
            rows={3}
            className={TEXTAREA_CLASS}
          />
        </label>
      </div>

      {(localError ?? error) && <Alert tone="error">{localError ?? error}</Alert>}

      <div className="flex justify-end gap-2 border-t border-stone-200 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Guardando…' : 'Guardar proveedor'}
        </Button>
      </div>
    </form>
  );
}
