import { useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { Product } from '../../types/product';
import type { PaymentMethod, SalesConfig } from '../../types/sales';
import { saveSalesConfig } from '../../data/sales';
import { formatCurrency } from '../../utils/format';
import { getEffectivePrice } from '../../utils/pricing';
import { normalizeSearch } from '../../utils/sales';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { MoneyInput } from '../ui/MoneyInput';
import { INPUT_CLASS, INPUT_COMPACT_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from '../ui/formStyles';
import { describeApiError, useAdminSession } from './adminSession';

interface AdminSalesSettingsProps {
  config: SalesConfig;
  products: Product[];
  onSaved: (config: SalesConfig) => void;
}

export function AdminSalesSettings({ config, products, onSaved }: AdminSalesSettingsProps) {
  const session = useAdminSession();
  const [sellers, setSellers] = useState<string[]>(config.sellers);
  const [methods, setMethods] = useState<PaymentMethod[]>(config.paymentMethods);
  const [costs, setCosts] = useState<Record<string, number>>(config.costs ?? {});
  const [bagDays, setBagDays] = useState(config.bagDays);
  const [sellerKey, setSellerKey] = useState('');
  const [removeKey, setRemoveKey] = useState(false);
  const [costSearch, setCostSearch] = useState('');
  const [isSaving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const productsForCosts = useMemo(() => {
    const needle = normalizeSearch(costSearch);
    return products
      .filter((p) => p.status !== 'archived')
      .filter((p) => !needle || normalizeSearch(p.name).includes(needle))
      // Primero los que no tenían costo al abrir la pantalla. Se ordena con lo guardado y no con lo
      // que se está escribiendo: si no, el renglón saltaría de lugar a mitad de la carga.
      .sort((a, b) => Number(Boolean(config.costs?.[a.id])) - Number(Boolean(config.costs?.[b.id])) || a.name.localeCompare(b.name));
  }, [products, costSearch, config.costs]);

  const missingCosts = products.filter((p) => p.status !== 'archived' && !costs[p.id]).length;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanMethods = methods.filter((m) => m.label.trim());
    if (cleanMethods.length === 0) {
      setFeedback({ tone: 'error', text: 'Tiene que haber al menos un medio de pago.' });
      return;
    }
    if (!Number.isInteger(bagDays) || bagDays < 1 || bagDays > 60) {
      setFeedback({ tone: 'error', text: 'Los días de bolsa abierta tienen que ser entre 1 y 60.' });
      return;
    }
    if (sellerKey && sellerKey.trim().length < 6) {
      setFeedback({ tone: 'error', text: 'La clave de vendedoras tiene que tener al menos 6 caracteres.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const saved = await saveSalesConfig(
        {
          sellers: sellers.map((s) => s.trim()).filter(Boolean),
          paymentMethods: cleanMethods,
          bagDays,
          costs,
          ...(removeKey ? { sellerKey: null } : sellerKey.trim() ? { sellerKey: sellerKey.trim() } : {}),
        },
        session.password,
      );
      onSaved(saved);
      setSellers(saved.sellers);
      setMethods(saved.paymentMethods);
      setSellerKey('');
      setRemoveKey(false);
      setFeedback({ tone: 'success', text: 'Guardado.' });
    } catch (err) {
      const message = describeApiError(err, session, 'No se pudo guardar.');
      if (message) setFeedback({ tone: 'error', text: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <Fieldset title="Vendedoras">
        <p className="mb-3 text-xs text-stone-600">
          Cada venta registra quién la hizo, y en Reportes ves cuánto vendió cada una. Si no cargás ninguna, no se pregunta.
        </p>
        <EditableList
          values={sellers}
          onChange={setSellers}
          placeholder="Nombre"
          addLabel="+ Agregar vendedora"
          itemLabel="vendedora"
        />
      </Fieldset>

      <Fieldset title="Medios de pago">
        <p className="mb-3 text-xs text-stone-600">
          Separá por cuenta si la plata entra en lugares distintos (ej: “MP Ima”, “MP Mary”, “Efectivo”): así el cierre de caja
          dice cuánto tendría que haber en cada una.
        </p>
        <div className="flex flex-col gap-2">
          {methods.map((method, index) => (
            <div key={method.id || `nuevo-${index}`} className="flex items-center gap-2">
              <input
                value={method.label}
                onChange={(e) => setMethods((prev) => prev.map((m, i) => (i === index ? { ...m, label: e.target.value } : m)))}
                aria-label={`Medio de pago ${index + 1}`}
                className={`${INPUT_COMPACT_CLASS} min-w-0 flex-1`}
              />
              <button
                type="button"
                onClick={() => setMethods((prev) => prev.filter((_, i) => i !== index))}
                disabled={methods.length <= 1}
                aria-label={`Quitar ${method.label || 'este medio'}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg text-stone-600 hover:bg-stone-100 hover:text-red-700 disabled:opacity-40"
              >
                ×
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            onClick={() => setMethods((prev) => [...prev, { id: '', label: '' }])}
          >
            + Agregar medio de pago
          </Button>
        </div>
        <p className="mt-2 text-xs text-stone-600">
          Renombrar un medio no cambia los cobros viejos: quedan con el nombre que tenían ese día.
        </p>
      </Fieldset>

      <Fieldset title="Bolsas de live">
        <p className="mb-3 text-xs text-stone-600">
          Cuando una clienta seña en un live se le abre una bolsa, y durante estos días se le siguen sumando prendas. Al
          vencer, la bolsa aparece marcada para cerrarla (cobrar el saldo y despachar), extenderla o cancelarla.
        </p>
        <label className={`${LABEL_CLASS} sm:max-w-xs`}>
          <span className={LABEL_TEXT_CLASS}>Días que queda abierta una bolsa</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            value={bagDays || ''}
            onChange={(e) => setBagDays(Math.round(Number(e.target.value)) || 0)}
            className={INPUT_CLASS}
          />
        </label>
        <p className="mt-2 text-xs text-stone-600">Cambiarlo vale para las bolsas nuevas; las abiertas mantienen su fecha.</p>
      </Fieldset>

      <Fieldset title="Acceso de vendedoras">
        <p className="mb-3 text-xs text-stone-600">
          Con esta clave las vendedoras entran al panel y solo ven <strong>Ventas</strong> y <strong>Clientas</strong>: no ven costos,
          ganancias ni reportes, y no pueden tocar productos ni configuración. Tu contraseña sigue siendo la única que abre todo.
        </p>
        <p className="mb-2 text-sm text-stone-700">
          Estado:{' '}
          <strong className="font-semibold">{config.hasSellerKey ? 'hay una clave activa' : 'todavía no hay clave'}</strong>
        </p>
        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>{config.hasSellerKey ? 'Cambiar la clave' : 'Crear la clave'} (mínimo 6 caracteres)</span>
          <input
            type="text"
            value={sellerKey}
            onChange={(e) => {
              setSellerKey(e.target.value);
              setRemoveKey(false);
            }}
            autoComplete="off"
            className={`${INPUT_CLASS} sm:max-w-xs`}
          />
        </label>
        {config.hasSellerKey && (
          <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={removeKey}
              onChange={(e) => {
                setRemoveKey(e.target.checked);
                if (e.target.checked) setSellerKey('');
              }}
            />
            Quitar la clave (nadie más que vos puede entrar)
          </label>
        )}
      </Fieldset>

      <Fieldset title="Costo de cada prenda">
        <p className="mb-3 text-xs text-stone-600">
          Lo que te cuesta una unidad (prenda terminada, o tela + taller). Con esto se calcula la ganancia de cada venta y en
          Reportes. No se publica en el catálogo y las vendedoras no lo ven.
          {missingCosts > 0 && (
            <strong className="mt-1 block font-semibold text-stock-low">
              {missingCosts} producto{missingCosts === 1 ? '' : 's'} sin costo cargado.
            </strong>
          )}
        </p>
        <input
          type="search"
          value={costSearch}
          onChange={(e) => setCostSearch(e.target.value)}
          placeholder="Buscar producto…"
          aria-label="Buscar producto para cargar el costo"
          className={`${INPUT_CLASS} mb-2`}
        />
        <ul className="flex flex-col divide-y divide-stone-100">
          {productsForCosts.map((product) => {
            const price = getEffectivePrice(product);
            const cost = costs[product.id] ?? 0;
            const margin = cost > 0 && price > 0 ? Math.round(((price - cost) / price) * 100) : null;
            return (
              <li key={product.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-stone-900">{product.name}</span>
                  <span className="block text-xs text-stone-600">
                    Precio {formatCurrency(price)}
                    {margin !== null && ` · margen ${margin}%`}
                  </span>
                </span>
                <MoneyInput
                  value={cost}
                  onChange={(value) =>
                    setCosts((prev) => {
                      const next = { ...prev };
                      if (value > 0) next[product.id] = value;
                      else delete next[product.id];
                      return next;
                    })
                  }
                  ariaLabel={`Costo de ${product.name}`}
                  className="w-32"
                />
              </li>
            );
          })}
        </ul>
      </Fieldset>

      {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}

      <div className="flex justify-end border-t border-stone-200 pt-4">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Guardando…' : 'Guardar ajustes de ventas'}
        </Button>
      </div>
    </form>
  );
}

function EditableList({
  values,
  onChange,
  placeholder,
  addLabel,
  itemLabel,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  addLabel: string;
  itemLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {values.map((value, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            value={value}
            onChange={(e) => onChange(values.map((v, i) => (i === index ? e.target.value : v)))}
            placeholder={placeholder}
            aria-label={`${itemLabel} ${index + 1}`}
            className={`${INPUT_COMPACT_CLASS} min-w-0 flex-1`}
          />
          <button
            type="button"
            onClick={() => onChange(values.filter((_, i) => i !== index))}
            aria-label={`Quitar ${value || `${itemLabel} ${index + 1}`}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg text-stone-600 hover:bg-stone-100 hover:text-red-700"
          >
            ×
          </button>
        </div>
      ))}
      <Button type="button" variant="secondary" className="self-start" onClick={() => onChange([...values, ''])}>
        {addLabel}
      </Button>
    </div>
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
