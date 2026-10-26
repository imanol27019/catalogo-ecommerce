import { useRef } from 'react';
import type { MessageTemplates } from '../../types/sales';
import { BUSINESS_NAME } from '../../config/site.config';
import {
  DEFAULT_TEMPLATES,
  MESSAGE_LABELS,
  MESSAGE_VARIABLES,
  messageValues,
  renderTemplate,
  SAMPLE_ORDER,
  type MessageKind,
} from '../../utils/messages';
import { Button } from '../ui/Button';
import { TEXTAREA_CLASS } from '../ui/formStyles';

const KINDS: MessageKind[] = ['summary', 'dispatch'];
const KNOWN = new Set(MESSAGE_VARIABLES.map((v) => v.key));

/**
 * Editor de los mensajes de WhatsApp. Se escribe el texto con los datos entre llaves ({nombre},
 * {seguimiento}…) y al lado se ve cómo le llegaría a una clienta de ejemplo.
 */
export function MessageTemplatesEditor({
  templates,
  onChange,
}: {
  templates: MessageTemplates;
  onChange: (templates: MessageTemplates) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-700">
        <p>
          Escribí el mensaje como quieras y usá los datos entre llaves; se reemplazan solos por los de cada venta. Si una línea
          usa un dato que esa venta no tiene (por ejemplo, el seguimiento cuando no hay código), esa línea no se manda.
        </p>
      </div>
      {KINDS.map((kind) => (
        <TemplateField
          key={kind}
          kind={kind}
          value={templates[kind]}
          onChange={(value) => onChange({ ...templates, [kind]: value })}
        />
      ))}
    </div>
  );
}

function TemplateField({ kind, value, onChange }: { kind: MessageKind; value: string; onChange: (value: string) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preview = renderTemplate(value, messageValues(SAMPLE_ORDER, BUSINESS_NAME));
  const unknown = [...new Set([...value.matchAll(/\{([^{}\s]+)\}/g)].map((m) => m[1]))].filter((key) => !KNOWN.has(key));
  const isDefault = value.trim() === DEFAULT_TEMPLATES[kind].trim();

  /** Inserta el dato donde está el cursor, para no tener que tipear las llaves. */
  function insert(variable: string) {
    const el = textareaRef.current;
    const token = `{${variable}}`;
    if (!el) {
      onChange(`${value}${token}`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    onChange(`${value.slice(0, start)}${token}${value.slice(end)}`);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="font-heading text-sm font-semibold text-stone-900">{MESSAGE_LABELS[kind].title}</h3>
        <p className="text-xs text-stone-600">{MESSAGE_LABELS[kind].hint}</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={11}
            aria-label={`Texto del mensaje: ${MESSAGE_LABELS[kind].title}`}
            className={`${TEXTAREA_CLASS} font-mono text-xs`}
          />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Datos para insertar">
            {MESSAGE_VARIABLES.map((variable) => (
              <button
                key={variable.key}
                type="button"
                title={variable.description}
                onClick={() => insert(variable.key)}
                className="inline-flex min-h-11 items-center rounded-full border border-stone-300 bg-white px-3 font-mono text-xs text-stone-700 hover:border-brand-400 hover:bg-brand-50"
              >
                {`{${variable.key}}`}
              </button>
            ))}
          </div>
          {unknown.length > 0 && (
            <p className="text-xs font-semibold text-stock-low">
              No reconozco {unknown.map((u) => `{${u}}`).join(', ')}: revisá cómo está escrito.
            </p>
          )}
          {!isDefault && (
            <Button type="button" variant="ghost" className="self-start" onClick={() => onChange(DEFAULT_TEMPLATES[kind])}>
              Volver al mensaje original
            </Button>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold text-stone-600">Así le llega a una clienta (ejemplo):</p>
          <pre className="whitespace-pre-wrap rounded-lg border border-stone-200 bg-stock-in-soft px-3 py-2 font-sans text-sm text-stone-900">
            {preview || '(vacío)'}
          </pre>
        </div>
      </div>
    </section>
  );
}
