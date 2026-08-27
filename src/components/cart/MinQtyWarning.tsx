interface MinQtyWarningProps {
  messages: string[];
}

/** Aviso informativo, nunca bloqueante: el pedido igual se puede enviar por WhatsApp. */
export function MinQtyWarning({ messages }: MinQtyWarningProps) {
  if (messages.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-stock-low-soft px-3 py-2.5 text-sm text-amber-900">
      <p className="font-semibold">Antes de confirmar, revisá:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}
