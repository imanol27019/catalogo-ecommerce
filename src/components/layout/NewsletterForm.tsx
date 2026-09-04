import { useState } from 'react';
import type { FormEvent } from 'react';
import { BUSINESS_NAME, NEWSLETTER, WHATSAPP_NUMBER } from '../../config/site.config';

/**
 * Sin backend no hay forma de que un mail cargado por una visitante llegue a una lista central
 * salvo por un canal que ya conecte ambos lados — por eso esto arma un WhatsApp al negocio en vez
 * de "guardar" el mail en algún lado que nadie va a revisar.
 */
export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  if (!NEWSLETTER.enabled) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    const message = `Hola ${BUSINESS_NAME}! Quiero recibir promociones y novedades por mail. Mi mail es: ${trimmed}`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    setSent(true);
  }

  return (
    <div>
      <p className="font-heading text-sm font-semibold text-white">{NEWSLETTER.title}</p>
      <p className="mt-1 text-xs text-stone-400">{NEWSLETTER.subtext}</p>
      {sent ? (
        <p className="mt-3 text-xs font-medium text-brand-300">¡Listo! Te vamos a estar escribiendo pronto.</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@mail.com"
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-stone-400 focus:border-brand-400"
          />
          <button
            type="submit"
            className="min-h-11 shrink-0 rounded-lg bg-brand-600 px-4 font-heading text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Sumarme
          </button>
        </form>
      )}
    </div>
  );
}
