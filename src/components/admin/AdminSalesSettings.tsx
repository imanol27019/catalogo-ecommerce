import { useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { Product } from '../../types/product';
import type { MessageTemplates, PaymentMethod, SalesConfig } from '../../types/sales';
import { saveSalesConfig } from '../../data/sales';
import { formatCurrency } from '../../utils/format';
import { getEffectivePrice } from '../../utils/pricing';
import { normalizeSearch } from '../../utils/sales';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { MoneyInput } from '../ui/MoneyInput';
import { INPUT_CLASS, INPUT_COMPACT_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from '../ui/formStyles';
import { describeApiError, useAdminSession } from './adminSession';
import { SellerAccountsEditor } from './SellerAccountsEditor';
import { MessageTemplatesEditor } from './MessageTemplatesEditor';
import { sellerDraftsFrom, sellerPayloadFrom, validateSellerDrafts, type SellerDraft } from '../../utils/sellerDrafts';
import { DEFAULT_TEMPLATES } from '../../utils/messages';

interface AdminSalesSettingsProps {
  config: SalesConfig;
  products: Product[];
  onSaved: (config: SalesConfig) => void;
}

export function AdminSalesSettings({ config, products, onSaved }: AdminSalesSettingsProps) {
  const session = useAdminSession();
  const [sellerDrafts, setSellerDrafts] = useState<SellerDraft[]>(() => sellerDraftsFrom(config.sellerAccounts));
  const [templates, setTemplates] = useState<MessageTemplates>(() => ({
    summary: config.messageTemplates.summary || DEFAULT_TEMPLATES.summary,
    dispatch: config.messageTemplates.dispatch || DEFAULT_TEMPLATES.dispatch,
  }));
  const [methods, setMethods] = useState<PaymentMethod[]>(config.paymentMethods);
  const [costs, setCosts] = useState<Record<string, number>>(config.costs ?? {});
  const [bagDays, setBagDays] = useState(config.bagDays);
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
    const sellersProblem = validateSellerDrafts(sellerDrafts);
    if (sellersProblem) {
      setFeedback({ tone: 'error', text: sellersProblem });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const saved = await saveSalesConfig(
        {
          sellerAccounts: sellerPayloadFrom(sellerDrafts),
          paymentMethods: cleanMethods,
          bagDays,
          costs,
          // Un mensaje igual al original se guarda vacío: así, si el original mejora, lo toma solo.
          messageTemplates: {
            summary: templates.summary.trim() === DEFAULT_TEMPLATES.summary.trim() ? '' : templates.summary,
            dispatch: templates.dispatch.trim() === DEFAULT_TEMPLATES.dispatch.trim() ? '' : templates.dispatch,
          },
        },
        session.password,
      );
      onSaved(saved);
      setSellerDrafts(sellerDraftsFrom(saved.sellerAccounts));
      setMethods(saved.paymentMethods);
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
        <SellerAccountsEditor drafts={sellerDrafts} onChange={setSellerDrafts} />
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

      <Fieldset title="Mensajes de WhatsApp">
        <MessageTemplatesEditor templates={templates} onChange={setTemplates} />
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

function Fieldset({ title, children }: { title: string; children: ReactNode }) {
  return (
    // `min-w-0`: los fieldset traen min-width:min-content del navegador y no se achican en pantallas chicas.
    <fieldset className="min-w-0 rounded-lg border border-stone-200 bg-white p-4">
      <legend className="px-1 font-heading text-sm font-semibold text-stone-900">{title}</legend>
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}
