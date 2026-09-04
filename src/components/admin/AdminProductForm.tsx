import { useState } from 'react';
import type { FormEvent } from 'react';
import type { BulkPriceTier, Product, ProductColor } from '../../types/product';
import type { Supplier } from '../../types/supplier';
import { CATEGORY_LABELS } from '../../config/site.config';
import { AdminImagesEditor } from './AdminImagesEditor';
import { regenerateVariants, slugify } from './adminUtils';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { INPUT_CLASS, INPUT_COMPACT_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS, TEXTAREA_CLASS } from '../ui/formStyles';

interface AdminProductFormProps {
  product: Product;
  /** Proveedores cargados en el panel, para elegir a quién se le compra este producto. */
  suppliers: Supplier[];
  adminPassword: string;
  onSave: (product: Product) => void;
  onCancel: () => void;
}

const SECTION_TITLE_CLASS = 'mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-600';

export function AdminProductForm({ product, suppliers, adminPassword, onSave, onCancel }: AdminProductFormProps) {
  const [draft, setDraft] = useState<Product>(product);
  const [error, setError] = useState<string | null>(null);

  function updateSizes(sizes: string[]) {
    setDraft((d) => ({ ...d, sizes, variants: regenerateVariants(sizes, d.colors, d.variants) }));
  }

  function updateColors(colors: ProductColor[]) {
    setDraft((d) => ({ ...d, colors, variants: regenerateVariants(d.sizes, colors, d.variants) }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!draft.name.trim()) {
      setError('Poné un nombre al producto.');
      return;
    }
    if (draft.sizes.length === 0 || draft.colors.length === 0) {
      setError('Agregá al menos un talle y un color.');
      return;
    }
    if (draft.salePrice != null && draft.salePrice >= draft.unitPrice) {
      setError('El precio de oferta tiene que ser menor al precio de lista.');
      return;
    }

    setError(null);
    onSave({ ...draft, slug: draft.slug || slugify(draft.name), updatedAt: new Date().toISOString() });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 rounded-lg border border-stone-200 bg-white p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Nombre</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className={INPUT_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Categoría</span>
          <input
            list="admin-categories"
            value={draft.category}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            className={INPUT_CLASS}
          />
          <datalist id="admin-categories">
            {Object.keys(CATEGORY_LABELS).map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
        </label>

        <label className={`${LABEL_CLASS} sm:col-span-2`}>
          <span className={LABEL_TEXT_CLASS}>Descripción</span>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            rows={2}
            className={TEXTAREA_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Precio unitario</span>
          <input
            type="number"
            min={0}
            value={draft.unitPrice}
            onChange={(e) => setDraft((d) => ({ ...d, unitPrice: Number(e.target.value) || 0 }))}
            className={INPUT_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Precio de oferta (opcional)</span>
          <input
            type="number"
            min={0}
            value={draft.salePrice ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, salePrice: e.target.value ? Number(e.target.value) : undefined }))}
            placeholder="Vacío = sin oferta"
            className={INPUT_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Mínimo por talle/color</span>
          <input
            type="number"
            min={1}
            value={draft.minQtyPerVariant}
            onChange={(e) => setDraft((d) => ({ ...d, minQtyPerVariant: Number(e.target.value) || 1 }))}
            className={INPUT_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Mínimo por producto (opcional)</span>
          <input
            type="number"
            min={0}
            value={draft.minQtyPerProduct ?? ''}
            onChange={(e) =>
              setDraft((d) => ({ ...d, minQtyPerProduct: e.target.value ? Number(e.target.value) : undefined }))
            }
            className={INPUT_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Estado</span>
          <select
            value={draft.status}
            onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as Product['status'] }))}
            className={INPUT_CLASS}
          >
            <option value="active">Activo</option>
            <option value="draft">Borrador</option>
            <option value="archived">Archivado</option>
          </select>
        </label>

        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Proveedor</span>
          <select
            value={draft.supplierId ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, supplierId: e.target.value || undefined }))}
            className={INPUT_CLASS}
          >
            <option value="">Sin asignar</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            {/* Si el proveedor guardado ya no existe (lo borraron), se muestra igual para no
                perder el dato en silencio al guardar el producto. */}
            {draft.supplierId && !suppliers.some((s) => s.id === draft.supplierId) && (
              <option value={draft.supplierId}>Proveedor eliminado</option>
            )}
          </select>
          {suppliers.length === 0 && (
            <span className="text-xs text-stone-500">Cargá proveedores en la pestaña Proveedores.</span>
          )}
        </label>

        <label className="flex min-h-11 items-center gap-2 text-sm text-stone-700 sm:pt-6">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={draft.featured ?? false}
            onChange={(e) => setDraft((d) => ({ ...d, featured: e.target.checked }))}
          />
          Mostrar en Destacados (portada)
        </label>
      </div>

      <AdminImagesEditor
        images={draft.images}
        adminPassword={adminPassword}
        onChange={(images) => setDraft((d) => ({ ...d, images }))}
      />

      <SizesEditor sizes={draft.sizes} onChange={updateSizes} />
      <ColorsEditor colors={draft.colors} onChange={updateColors} />

      {/*
        Acá había una grilla para elegir a mano el estado de cada variante (disponible / poco /
        sin stock). Quedó obsoleta cuando el stock pasó a llevarse en unidades: el estado se
        deriva de la cantidad, así que elegirlo aparte solo permitía que se contradijeran.
        Las unidades se cargan en la pestaña Stock y bajan solas al registrar una venta.
      */}
      <Alert tone="info">
        El stock se maneja por unidades en la pestaña <strong>Stock</strong>. Los talles y colores nuevos entran
        con 0 unidades.
      </Alert>

      <BulkPricingEditor
        tiers={draft.bulkPricing ?? []}
        onChange={(bulkPricing) => setDraft((d) => ({ ...d, bulkPricing: bulkPricing.length ? bulkPricing : undefined }))}
      />

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex justify-end gap-2 border-t border-stone-200 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">Guardar</Button>
      </div>
    </form>
  );
}

function RemoveTagButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-6 w-6 items-center justify-center rounded-full text-stone-500 hover:bg-stone-200 hover:text-red-700"
    >
      ×
    </button>
  );
}

function SizesEditor({ sizes, onChange }: { sizes: string[]; onChange: (sizes: string[]) => void }) {
  const [draft, setDraft] = useState('');

  function addSize() {
    const trimmed = draft.trim();
    if (trimmed && !sizes.includes(trimmed)) onChange([...sizes, trimmed]);
    setDraft('');
  }

  return (
    <div>
      <p className={SECTION_TITLE_CLASS}>Talles</p>
      <div className="mb-2 flex flex-wrap gap-2">
        {sizes.map((size) => (
          <span
            key={size}
            className="flex items-center gap-1 rounded-full bg-stone-100 py-1 pl-3 pr-1 text-sm font-medium text-stone-700"
          >
            {size}
            <RemoveTagButton label={`Quitar talle ${size}`} onClick={() => onChange(sizes.filter((s) => s !== size))} />
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addSize();
            }
          }}
          placeholder="Ej: XL"
          aria-label="Nuevo talle"
          className={`${INPUT_COMPACT_CLASS} w-28`}
        />
        <Button type="button" variant="secondary" onClick={addSize}>
          Agregar
        </Button>
      </div>
    </div>
  );
}

function ColorsEditor({ colors, onChange }: { colors: ProductColor[]; onChange: (colors: ProductColor[]) => void }) {
  const [name, setName] = useState('');
  const [hex, setHex] = useState('#111111');

  function addColor() {
    const trimmed = name.trim();
    if (trimmed && !colors.some((c) => c.name === trimmed)) onChange([...colors, { name: trimmed, hex }]);
    setName('');
  }

  return (
    <div>
      <p className={SECTION_TITLE_CLASS}>Colores</p>
      <div className="mb-2 flex flex-wrap gap-2">
        {colors.map((color) => (
          <span
            key={color.name}
            className="flex items-center gap-1.5 rounded-full bg-stone-100 py-1 pl-2 pr-1 text-sm font-medium text-stone-700"
          >
            {/* Color del producto: viene de los datos, no del sistema de diseño, por eso va inline. */}
            <span
              className="h-4 w-4 rounded-full ring-1 ring-inset ring-black/10"
              style={{ backgroundColor: color.hex }}
            />
            {color.name}
            <RemoveTagButton
              label={`Quitar color ${color.name}`}
              onClick={() => onChange(colors.filter((c) => c.name !== color.name))}
            />
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          aria-label="Color del nuevo tono"
          className="h-11 w-11 rounded-lg border border-stone-300 p-1"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addColor();
            }
          }}
          placeholder="Ej: Verde militar"
          aria-label="Nombre del nuevo color"
          className={`${INPUT_COMPACT_CLASS} w-40`}
        />
        <Button type="button" variant="secondary" onClick={addColor}>
          Agregar
        </Button>
      </div>
    </div>
  );
}

function BulkPricingEditor({ tiers, onChange }: { tiers: BulkPriceTier[]; onChange: (tiers: BulkPriceTier[]) => void }) {
  function updateTier(index: number, patch: Partial<BulkPriceTier>) {
    onChange(tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  return (
    <div>
      <p className={SECTION_TITLE_CLASS}>Precio por bulto (opcional)</p>
      <div className="flex flex-col gap-2">
        {tiers.map((tier, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-stone-600">Desde</span>
            <input
              type="number"
              min={2}
              value={tier.minQty}
              onChange={(e) => updateTier(index, { minQty: Number(e.target.value) || 2 })}
              aria-label="Cantidad mínima del escalón"
              className={`${INPUT_COMPACT_CLASS} w-20`}
            />
            <span className="text-sm text-stone-600">u. a</span>
            <input
              type="number"
              min={0}
              value={tier.price}
              onChange={(e) => updateTier(index, { price: Number(e.target.value) || 0 })}
              aria-label="Precio por unidad del escalón"
              className={`${INPUT_COMPACT_CLASS} w-28`}
            />
            <span className="text-sm text-stone-600">c/u</span>
            <RemoveTagButton
              label="Quitar escalón de precio"
              onClick={() => onChange(tiers.filter((_, i) => i !== index))}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
         
          className="self-start"
          onClick={() => onChange([...tiers, { minQty: 6, price: 0 }])}
        >
          + Agregar escalón de precio
        </Button>
      </div>
    </div>
  );
}
