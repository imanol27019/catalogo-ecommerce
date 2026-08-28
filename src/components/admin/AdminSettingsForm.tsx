import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { FaqItem, ShippingMethodOption, SiteSettings } from '../../types/settings';
import { Button } from '../ui/Button';
import { INPUT_CLASS, INPUT_COMPACT_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS, TEXTAREA_CLASS } from '../ui/formStyles';

interface AdminSettingsFormProps {
  settings: SiteSettings;
  onSave: (settings: SiteSettings) => void;
  saveLabel?: string;
}

export function AdminSettingsForm({ settings, onSave, saveLabel = 'Guardar cambios' }: AdminSettingsFormProps) {
  const [draft, setDraft] = useState<SiteSettings>(settings);

  function update<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSave(draft);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Fieldset title="Datos del negocio">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Nombre del negocio" value={draft.businessName} onChange={(v) => update('businessName', v)} />
          <TextField label="Frase / rubro" value={draft.businessTagline} onChange={(v) => update('businessTagline', v)} />
          <TextField
            label="WhatsApp (solo dígitos, formato 549...)"
            value={draft.whatsappNumber}
            onChange={(v) => update('whatsappNumber', v)}
          />
          <TextField label="Email de contacto" value={draft.contactEmail} onChange={(v) => update('contactEmail', v)} />
          <TextField label="Dirección" value={draft.contactAddress} onChange={(v) => update('contactAddress', v)} />
          <TextField label="Horario de atención" value={draft.contactHours} onChange={(v) => update('contactHours', v)} />
        </div>
      </Fieldset>

      <Fieldset title="Mínimo de compra mayorista">
        <p className="mb-3 text-xs text-stone-600">
          Para poder finalizar el pedido por WhatsApp alcanza con cumplir UNA de las dos condiciones (cantidad o
          monto). Dejar en 0 desactiva esa condición.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Mínimo de prendas (0 = sin mínimo)"
            value={draft.minOrderQty}
            onChange={(v) => update('minOrderQty', v)}
          />
          <NumberField
            label="Mínimo de monto total (0 = sin mínimo)"
            value={draft.minOrderTotal}
            onChange={(v) => update('minOrderTotal', v)}
          />
          <NumberField
            label='Avisar "poco stock" con esta cantidad o menos'
            value={draft.lowStockThreshold}
            onChange={(v) => update('lowStockThreshold', v)}
          />
        </div>
        <div className="mt-4">
          <TextField
            label="Mensaje manual de la barra superior (opcional — vacío = se genera solo a partir de los mínimos)"
            value={draft.announcementMessage ?? ''}
            onChange={(v) => update('announcementMessage', v.trim() ? v : null)}
          />
        </div>
      </Fieldset>

      <Fieldset title="Banner de portada">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Texto pequeño" value={draft.hero.eyebrow} onChange={(v) => update('hero', { ...draft.hero, eyebrow: v })} />
          <TextField label="Título" value={draft.hero.heading} onChange={(v) => update('hero', { ...draft.hero, heading: v })} />
          <TextField
            label="Texto del botón"
            value={draft.hero.ctaLabel}
            onChange={(v) => update('hero', { ...draft.hero, ctaLabel: v })}
          />
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className={LABEL_TEXT_CLASS}>Subtexto</span>
            <textarea
              value={draft.hero.subtext}
              onChange={(e) => update('hero', { ...draft.hero, subtext: e.target.value })}
              rows={2}
              className={TEXTAREA_CLASS}
            />
          </label>
        </div>
        <div className="mt-4">
          <HeroImagesEditor images={draft.hero.images} onChange={(images) => update('hero', { ...draft.hero, images })} />
        </div>
      </Fieldset>

      <Fieldset title="Métodos de envío">
        <ShippingMethodsEditor methods={draft.shippingMethods} onChange={(shippingMethods) => update('shippingMethods', shippingMethods)} />
      </Fieldset>

      <Fieldset title="Preguntas frecuentes">
        <FaqEditor items={draft.faq} onChange={(faq) => update('faq', faq)} />
      </Fieldset>

      <Fieldset title="Newsletter">
        <label className="flex min-h-11 items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={draft.newsletter.enabled}
            onChange={(e) => update('newsletter', { ...draft.newsletter, enabled: e.target.checked })}
          />
          Mostrar formulario de suscripción en el footer
        </label>
        {draft.newsletter.enabled && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <TextField
              label="Título"
              value={draft.newsletter.title}
              onChange={(v) => update('newsletter', { ...draft.newsletter, title: v })}
            />
            <TextField
              label="Subtexto"
              value={draft.newsletter.subtext}
              onChange={(v) => update('newsletter', { ...draft.newsletter, subtext: v })}
            />
          </div>
        )}
      </Fieldset>

      <div className="flex justify-end border-t border-stone-200 pt-4">
        <Button type="submit">{saveLabel}</Button>
      </div>
    </form>
  );
}

function Fieldset({ title, children }: { title: string; children: ReactNode }) {
  return (
    // `min-w-0`: los fieldset traen min-width:min-content del navegador y no se achican en pantallas chicas.
    <fieldset className="min-w-0 rounded-lg border border-stone-200 bg-white p-4">
      <legend className="px-1 font-heading text-sm font-semibold text-stone-900">{title}</legend>
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className={LABEL_CLASS}>
      <span className={LABEL_TEXT_CLASS}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLASS}
      />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className={LABEL_CLASS}>
      <span className={LABEL_TEXT_CLASS}>{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={INPUT_CLASS}
      />
    </label>
  );
}

function ShippingMethodsEditor({
  methods,
  onChange,
}: {
  methods: ShippingMethodOption[];
  onChange: (methods: ShippingMethodOption[]) => void;
}) {
  function updateMethod(index: number, patch: Partial<ShippingMethodOption>) {
    onChange(methods.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }
  function addMethod() {
    onChange([...methods, { id: `metodo-${Date.now()}`, label: 'Nuevo método', description: '' }]);
  }
  function removeMethod(index: number) {
    onChange(methods.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      {methods.map((method, index) => (
        <div key={method.id} className="flex flex-col gap-2 rounded-lg border border-stone-200 p-3 sm:flex-row sm:items-start">
          <div className="grid flex-1 gap-2 sm:grid-cols-2">
            <input
              value={method.label}
              onChange={(e) => updateMethod(index, { label: e.target.value })}
              placeholder="Nombre"
              className={INPUT_COMPACT_CLASS}
            />
            <input
              value={method.description ?? ''}
              onChange={(e) => updateMethod(index, { description: e.target.value })}
              placeholder="Descripción (opcional)"
              className={INPUT_COMPACT_CLASS}
            />
          </div>
          <button
            type="button"
            onClick={() => removeMethod(index)}
            aria-label={`Quitar el método "${method.label}"`}
            className="flex h-11 w-11 shrink-0 items-center justify-center self-start rounded-lg text-lg text-stone-600 hover:bg-stone-100 hover:text-red-700"
          >
            ×
          </button>
        </div>
      ))}
      <Button type="button" variant="secondary" className="self-start" onClick={addMethod}>
        + Agregar método
      </Button>
    </div>
  );
}

function FaqEditor({ items, onChange }: { items: FaqItem[]; onChange: (items: FaqItem[]) => void }) {
  function updateItem(index: number, patch: Partial<FaqItem>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  function addItem() {
    onChange([...items, { question: 'Nueva pregunta', answer: '' }]);
  }
  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <div key={index} className="flex flex-col gap-2 rounded-lg border border-stone-200 p-3">
          <div className="flex items-start gap-2">
            <input
              value={item.question}
              onChange={(e) => updateItem(index, { question: e.target.value })}
              placeholder="Pregunta"
              className={`${INPUT_COMPACT_CLASS} flex-1`}
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              aria-label="Quitar esta pregunta"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg text-stone-600 hover:bg-stone-100 hover:text-red-700"
            >
              ×
            </button>
          </div>
          <textarea
            value={item.answer}
            onChange={(e) => updateItem(index, { answer: e.target.value })}
            placeholder="Respuesta"
            rows={2}
            className={`${INPUT_COMPACT_CLASS} resize-none`}
          />
        </div>
      ))}
      <Button type="button" variant="secondary" className="self-start" onClick={addItem}>
        + Agregar pregunta
      </Button>
    </div>
  );
}

function HeroImagesEditor({ images, onChange }: { images: string[]; onChange: (images: string[]) => void }) {
  const [draft, setDraft] = useState('');

  function addImage() {
    const trimmed = draft.trim();
    if (trimmed) onChange([...images, trimmed]);
    setDraft('');
  }

  function removeImage(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
        Fotos de fondo del banner (rotan automáticamente — vacío usa un degradé de marca)
      </p>
      <div className="mb-2 flex flex-wrap gap-2">
        {images.map((src, index) => (
          <div key={src} className="relative h-16 w-16 overflow-hidden rounded-lg ring-1 ring-stone-200">
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeImage(index)}
              aria-label={`Quitar la foto ${index + 1} del banner`}
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-lg text-white drop-shadow"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addImage();
            }
          }}
          placeholder="URL de la imagen"
          className={`${INPUT_COMPACT_CLASS} flex-1`}
        />
        <Button type="button" variant="secondary" onClick={addImage}>
          Agregar
        </Button>
      </div>
    </div>
  );
}
