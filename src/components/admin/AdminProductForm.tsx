import { useState } from 'react';
import type { FormEvent } from 'react';
import type { BulkPriceTier, Product, ProductColor } from '../../types/product';
import { CATEGORY_LABELS } from '../../config/site.config';
import { AdminVariantEditor } from './AdminVariantEditor';
import { regenerateVariants, slugify } from './adminUtils';
import { Button } from '../ui/Button';

interface AdminProductFormProps {
  product: Product;
  onSave: (product: Product) => void;
  onCancel: () => void;
}

export function AdminProductForm({ product, onSave, onCancel }: AdminProductFormProps) {
  const [draft, setDraft] = useState<Product>(product);

  function updateSizes(sizes: string[]) {
    setDraft((d) => ({ ...d, sizes, variants: regenerateVariants(sizes, d.colors, d.variants) }));
  }

  function updateColors(colors: ProductColor[]) {
    setDraft((d) => ({ ...d, colors, variants: regenerateVariants(d.sizes, colors, d.variants) }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSave({ ...draft, slug: draft.slug || slugify(draft.name), updatedAt: new Date().toISOString() });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-lg border border-stone-200 bg-white p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-stone-700">Nombre</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            required
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-stone-700">Categoría</span>
          <input
            list="admin-categories"
            value={draft.category}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <datalist id="admin-categories">
            {Object.keys(CATEGORY_LABELS).map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-semibold text-stone-700">Descripción</span>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            rows={2}
            className="resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-stone-700">Precio unitario</span>
          <input
            type="number"
            min={0}
            value={draft.unitPrice}
            onChange={(e) => setDraft((d) => ({ ...d, unitPrice: Number(e.target.value) || 0 }))}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-stone-700">Precio de oferta (opcional)</span>
          <input
            type="number"
            min={0}
            value={draft.salePrice ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, salePrice: e.target.value ? Number(e.target.value) : undefined }))}
            placeholder="Vacío = sin oferta"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-stone-700">Mínimo por talle/color</span>
          <input
            type="number"
            min={1}
            value={draft.minQtyPerVariant}
            onChange={(e) => setDraft((d) => ({ ...d, minQtyPerVariant: Number(e.target.value) || 1 }))}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-stone-700">Mínimo por producto (opcional)</span>
          <input
            type="number"
            min={0}
            value={draft.minQtyPerProduct ?? ''}
            onChange={(e) =>
              setDraft((d) => ({ ...d, minQtyPerProduct: e.target.value ? Number(e.target.value) : undefined }))
            }
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-stone-700">Estado</span>
          <select
            value={draft.status}
            onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as Product['status'] }))}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="active">Activo</option>
            <option value="draft">Borrador</option>
            <option value="archived">Archivado</option>
          </select>
        </label>

        <label className="flex items-center gap-2 pt-6 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={draft.featured ?? false}
            onChange={(e) => setDraft((d) => ({ ...d, featured: e.target.checked }))}
          />
          Mostrar en Destacados (portada)
        </label>
      </div>

      <SizesEditor sizes={draft.sizes} onChange={updateSizes} />
      <ColorsEditor colors={draft.colors} onChange={updateColors} />

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">Stock por talle / color</p>
        <AdminVariantEditor product={draft} onChange={(variants) => setDraft((d) => ({ ...d, variants }))} />
      </div>

      <BulkPricingEditor
        tiers={draft.bulkPricing ?? []}
        onChange={(bulkPricing) => setDraft((d) => ({ ...d, bulkPricing: bulkPricing.length ? bulkPricing : undefined }))}
      />

      <div className="flex justify-end gap-2 border-t border-stone-200 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">Guardar</Button>
      </div>
    </form>
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
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">Talles</p>
      <div className="mb-2 flex flex-wrap gap-2">
        {sizes.map((size) => (
          <span key={size} className="flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
            {size}
            <button type="button" onClick={() => onChange(sizes.filter((s) => s !== size))} className="text-stone-400 hover:text-red-500">
              ×
            </button>
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
          className="w-28 rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
        />
        <button type="button" onClick={addSize} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50">
          Agregar
        </button>
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
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">Colores</p>
      <div className="mb-2 flex flex-wrap gap-2">
        {colors.map((color) => (
          <span
            key={color.name}
            className="flex items-center gap-1.5 rounded-full bg-stone-100 py-1 pl-1.5 pr-2.5 text-xs font-medium text-stone-700"
          >
            <span className="h-3.5 w-3.5 rounded-full ring-1 ring-inset ring-black/10" style={{ backgroundColor: color.hex }} />
            {color.name}
            <button
              type="button"
              onClick={() => onChange(colors.filter((c) => c.name !== color.name))}
              className="text-stone-400 hover:text-red-500"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          className="h-9 w-9 rounded border border-stone-300 p-0.5"
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
          className="w-40 rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
        />
        <button type="button" onClick={addColor} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50">
          Agregar
        </button>
      </div>
    </div>
  );
}

function BulkPricingEditor({ tiers, onChange }: { tiers: BulkPriceTier[]; onChange: (tiers: BulkPriceTier[]) => void }) {
  function updateTier(index: number, patch: Partial<BulkPriceTier>) {
    onChange(tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function addTier() {
    onChange([...tiers, { minQty: 6, price: 0 }]);
  }

  function removeTier(index: number) {
    onChange(tiers.filter((_, i) => i !== index));
  }

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">Precio por bulto (opcional)</p>
      <div className="flex flex-col gap-2">
        {tiers.map((tier, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-stone-500">Desde</span>
            <input
              type="number"
              min={2}
              value={tier.minQty}
              onChange={(e) => updateTier(index, { minQty: Number(e.target.value) || 2 })}
              className="w-20 rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
            />
            <span className="text-sm text-stone-500">u. a</span>
            <input
              type="number"
              min={0}
              value={tier.price}
              onChange={(e) => updateTier(index, { price: Number(e.target.value) || 0 })}
              className="w-28 rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
            />
            <span className="text-sm text-stone-500">c/u</span>
            <button type="button" onClick={() => removeTier(index)} className="text-stone-400 hover:text-red-500">
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addTier}
          className="self-start rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50"
        >
          + Agregar escalón de precio
        </button>
      </div>
    </div>
  );
}
