import { useMemo, useState } from 'react';
import type { SaleChannel } from '../../types/order';
import type { Client, ClientPayload, ClientWithStats } from '../../types/sales';
import { formatCurrency } from '../../utils/format';
import { matchesClient, normalizeSearch } from '../../utils/sales';
import { describeApiError, useAdminSession } from './adminSession';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { INPUT_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from '../ui/formStyles';

interface ClientPickerProps {
  clients: ClientWithStats[];
  value: Client | null;
  onChange: (client: Client | null) => void;
  /** Da de alta la clienta en el servidor y devuelve la ficha creada. */
  onCreate: (payload: ClientPayload) => Promise<Client>;
  channel: SaleChannel;
}

export function ClientPicker({ clients, value, onChange, onCreate, channel }: ClientPickerProps) {
  const [search, setSearch] = useState('');
  const [isCreating, setCreating] = useState(false);

  const results = useMemo(() => {
    const needle = normalizeSearch(search);
    if (!needle) return [];
    return clients.filter((c) => matchesClient(c, needle)).slice(0, 6);
  }, [clients, search]);

  if (value) {
    const stats = clients.find((c) => c.id === value.id)?.stats;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
        <div className="min-w-0">
          <p className="font-heading text-sm font-semibold text-stone-900">{value.name}</p>
          <p className="text-xs text-stone-600">
            {[value.tiktok && `@${value.tiktok}`, value.whatsapp, value.locality].filter(Boolean).join(' · ') ||
              'Sin datos de contacto'}
          </p>
          {stats && stats.balance > 0 && (
            <p className="mt-0.5 text-xs font-semibold text-stock-low">
              Ya debe {formatCurrency(stats.balance)} de compras anteriores
            </p>
          )}
        </div>
        <Button type="button" variant="ghost" onClick={() => onChange(null)}>
          Cambiar
        </Button>
      </div>
    );
  }

  if (isCreating) {
    return (
      <NewClientForm
        initialText={search}
        channel={channel}
        onCancel={() => setCreating(false)}
        onCreate={async (payload) => {
          const client = await onCreate(payload);
          setCreating(false);
          setSearch('');
          onChange(client);
        }}
      />
    );
  }

  return (
    <div>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={channel === 'tiktok' ? 'Buscar por @usuario o nombre…' : 'Buscar por nombre, @tiktok o WhatsApp…'}
        aria-label="Buscar clienta"
        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
        className={INPUT_CLASS}
      />
      {(results.length > 0 || search.trim()) && (
        <ul className="mt-1.5 flex flex-col gap-1">
          {results.map((client) => (
            <li key={client.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(client);
                  setSearch('');
                }}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-left hover:border-brand-400 hover:bg-brand-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-stone-900">{client.name}</span>
                  <span className="block truncate text-xs text-stone-600">
                    {[client.tiktok && `@${client.tiktok}`, client.whatsapp, client.locality].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {client.stats.balance > 0 && (
                  <span className="shrink-0 text-xs font-semibold text-stock-low">Debe {formatCurrency(client.stats.balance)}</span>
                )}
              </button>
            </li>
          ))}
          {search.trim() && (
            <li>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex min-h-11 w-full items-center rounded-lg border border-dashed border-brand-300 px-3 text-left text-sm font-semibold text-brand-700 hover:bg-brand-50"
              >
                + Nueva clienta “{search.trim()}”
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function NewClientForm({
  initialText,
  channel,
  onCancel,
  onCreate,
}: {
  initialText: string;
  channel: SaleChannel;
  onCancel: () => void;
  onCreate: (payload: ClientPayload) => Promise<void>;
}) {
  // Lo que se escribió en el buscador se reparte solo: "@juli.mayorista" va a TikTok, un número va
  // a WhatsApp y cualquier otra cosa es el nombre.
  const text = initialText.trim();
  const looksLikeTiktok = text.startsWith('@') || (channel === 'tiktok' && !/\s/.test(text));
  const looksLikePhone = /^[\d\s+()-]{6,}$/.test(text);

  const [name, setName] = useState(looksLikeTiktok || looksLikePhone ? '' : text);
  const [tiktok, setTiktok] = useState(looksLikeTiktok ? text.replace(/^@/, '') : '');
  const [whatsapp, setWhatsapp] = useState(looksLikePhone ? text : '');
  const [locality, setLocality] = useState('');
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = useAdminSession();

  async function save() {
    const finalName = name.trim() || (tiktok.trim() ? `@${tiktok.trim().replace(/^@/, '')}` : '');
    if (!finalName) {
      setError('Poné al menos un nombre o el usuario de TikTok.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate({ name: finalName, tiktok, whatsapp, locality });
    } catch (err) {
      setError(describeApiError(err, session, 'No se pudo crear la clienta.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    // No es un <form>: vive dentro del formulario de la venta y un form anidado no es HTML válido.
    // Enter en uno de estos campos mandaría el formulario de la venta entera: acá guarda la clienta.
    <div
      className="flex flex-col gap-3 rounded-lg border border-brand-200 bg-white p-3"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
          e.preventDefault();
          void save();
        }
      }}
    >
      <p className="font-heading text-sm font-semibold text-stone-900">Nueva clienta</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Nombre o apodo</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} autoFocus={!looksLikeTiktok} />
        </label>
        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Usuario de TikTok</span>
          <input
            value={tiktok}
            onChange={(e) => setTiktok(e.target.value)}
            placeholder="@usuario"
            autoCapitalize="none"
            className={INPUT_CLASS}
          />
        </label>
        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>WhatsApp</span>
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            inputMode="tel"
            placeholder="11 2345 6789"
            className={INPUT_CLASS}
          />
        </label>
        <label className={LABEL_CLASS}>
          <span className={LABEL_TEXT_CLASS}>Localidad</span>
          <input value={locality} onChange={(e) => setLocality(e.target.value)} className={INPUT_CLASS} />
        </label>
      </div>
      <p className="text-xs text-stone-600">
        WhatsApp con código de país y de área, sin el 0 ni el 15 (ej: 5491123456789), para poder abrir el chat directo.
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" onClick={() => void save()} disabled={isSaving}>
          {isSaving ? 'Guardando…' : 'Guardar clienta'}
        </Button>
      </div>
    </div>
  );
}
