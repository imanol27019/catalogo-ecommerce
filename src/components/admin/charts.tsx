import { useState } from 'react';

/**
 * Gráficos del panel, hechos con HTML y CSS (sin librerías). Todos son de UNA serie, así que
 * usan un solo color (brand-600, 5.66:1 sobre blanco) y la identidad de cada barra la da su
 * etiqueta, nunca el color. Los textos van siempre en tinta de texto, no en el color de la barra.
 */

export interface ColumnPoint {
  key: string;
  /** Etiqueta corta del eje (ej: "23/10", "oct"). */
  label: string;
  value: number;
  /** Texto del tooltip debajo del valor (ej: "4 ventas · 12 prendas"). */
  detail?: string;
  /** Etiqueta larga para el tooltip y el lector de pantalla (ej: "viernes 23/10"). */
  longLabel?: string;
}

/** 0 / 1 / 2 / 5 × 10^n: marcas del eje que se leen de un vistazo. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const step = [1, 2, 2.5, 5, 10].find((m) => m * base >= value) ?? 10;
  return step * base;
}

const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });

function formatCompactMoney(value: number): string {
  return `$${compact.format(value)}`;
}

/**
 * Columnas por día o por mes. Cada columna es su propio blanco de hover y de foco (toda la franja
 * vertical, no solo la barra pintada), y muestra fecha, monto y detalle en un tooltip.
 */
export function ColumnChart({
  points,
  formatValue,
  ariaLabel,
  unitNoun,
}: {
  points: ColumnPoint[];
  formatValue: (value: number) => string;
  ariaLabel: string;
  /** "día" o "mes": para el renglón que destaca el mejor período. */
  unitNoun: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...points.map((p) => p.value), 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  // Con muchas columnas no entran todas las etiquetas: se muestra una cada N, más la última.
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  const peakIndex = points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0);
  const activePoint = active !== null ? points[active] : null;
  // El tooltip se ancla a la columna y se corre hacia adentro en los bordes para no salirse.
  const activeRatio = active !== null ? (active + 0.5) / points.length : 0;
  const tooltipShift = activeRatio > 0.6 ? '-100%' : activeRatio < 0.4 ? '0' : '-50%';

  return (
    <div className="relative">
      <div className="flex">
        <div aria-hidden="true" className="relative mr-2 h-48 w-12 shrink-0 text-right text-[11px] tabular-nums text-stone-600">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0" style={{ bottom: `${(t / max) * 100}%`, transform: 'translateY(50%)' }}>
              {formatCompactMoney(t)}
            </span>
          ))}
        </div>
        {/*
          Una sola parada de teclado para todo el gráfico: con las flechas se recorre columna por
          columna (con 31 días, una parada por columna haría eterno pasar de largo). El mouse usa
          toda la franja vertical de cada columna como blanco, no solo la barra pintada.
        */}
        <div
          className="relative h-48 min-w-0 flex-1 rounded outline-offset-4"
          role="group"
          aria-label={`${ariaLabel}. Usá las flechas para recorrerlo.`}
          tabIndex={0}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((current) => current ?? (peakIndex >= 0 ? peakIndex : points.length - 1))}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
            e.preventDefault();
            setActive((current) => {
              const from = current ?? peakIndex;
              if (e.key === 'Home') return 0;
              if (e.key === 'End') return points.length - 1;
              return Math.min(points.length - 1, Math.max(0, from + (e.key === 'ArrowRight' ? 1 : -1)));
            });
          }}
        >
          {ticks.map((t) => (
            <div
              key={t}
              aria-hidden="true"
              className={`absolute inset-x-0 h-px ${t === 0 ? 'bg-stone-300' : 'bg-stone-100'}`}
              style={{ bottom: `${(t / max) * 100}%` }}
            />
          ))}
          <div aria-hidden="true" className="absolute inset-0 flex items-end">
            {points.map((point, index) => {
              const height = (point.value / max) * 100;
              const isActive = active === index;
              return (
                <div
                  key={point.key}
                  onPointerEnter={() => setActive(index)}
                  className="relative flex h-full min-w-0 flex-1 items-end justify-center"
                >
                  <span
                    className={`block w-full max-w-6 rounded-t transition-colors ${
                      isActive ? 'bg-brand-700' : 'bg-brand-600'
                    }`}
                    style={{ height: `${height}%`, marginInline: '1px', minHeight: point.value > 0 ? 2 : 0 }}
                  />
                </div>
              );
            })}
          </div>
          {activePoint && (
            <div
              role="status"
              className="pointer-events-none absolute -top-2 z-10 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs shadow-md"
              style={{ left: `${activeRatio * 100}%`, transform: `translate(${tooltipShift}, -100%)` }}
            >
              <p className="font-heading text-sm font-semibold text-stone-900">{formatValue(activePoint.value)}</p>
              <p className="whitespace-nowrap text-stone-600">{activePoint.longLabel ?? activePoint.label}</p>
              {activePoint.detail && <p className="whitespace-nowrap text-stone-600">{activePoint.detail}</p>}
            </div>
          )}
        </div>
      </div>
      <div aria-hidden="true" className="ml-14 flex text-[11px] text-stone-600">
        {points.map((point, index) => (
          <span key={point.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
            {index === points.length - 1 || (index % labelEvery === 0 && points.length - 1 - index >= labelEvery)
              ? point.label
              : ''}
          </span>
        ))}
      </div>
      {points.length > 1 && points[peakIndex].value > 0 && (
        <p className="mt-2 text-xs text-stone-600">
          Mejor {unitNoun}:{' '}
          <strong className="font-semibold text-stone-900">
            {points[peakIndex].longLabel ?? points[peakIndex].label} · {formatValue(points[peakIndex].value)}
          </strong>
        </p>
      )}
    </div>
  );
}

export interface BarItem {
  key: string;
  label: string;
  value: number;
  /** Lo que se escribe en la punta de la barra (ej: "$120.000 · 38%"). */
  valueLabel: string;
  detail?: string;
}

/**
 * Ranking horizontal: etiqueta, barra y valor en la punta. Para pocas categorías con nombres
 * largos (canales, medios de pago, vendedoras) se lee mejor que columnas.
 */
export function BarList({ items, ariaLabel }: { items: BarItem[]; ariaLabel: string }) {
  const max = Math.max(...items.map((i) => i.value), 0) || 1;
  return (
    <ul className="flex flex-col gap-2.5" aria-label={ariaLabel}>
      {items.map((item) => (
        <li key={item.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-stone-800">{item.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-stone-900">{item.valueLabel}</span>
          </div>
          <div aria-hidden="true" className="h-2.5 w-full rounded-full bg-brand-50">
            <div
              className="h-full rounded-full bg-brand-600"
              style={{ width: `${Math.max(item.value > 0 ? 2 : 0, (item.value / max) * 100)}%` }}
            />
          </div>
          {item.detail && <span className="text-xs text-stone-600">{item.detail}</span>}
        </li>
      ))}
    </ul>
  );
}
