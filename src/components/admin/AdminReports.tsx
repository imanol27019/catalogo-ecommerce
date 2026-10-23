import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { SalesReport } from '../../types/sales';
import { fetchSalesReport } from '../../data/sales';
import { formatCurrency, plural } from '../../utils/format';
import {
  addDays,
  CHANNEL_LABELS,
  endOfMonth,
  formatDayLabel,
  formatMonthLabel,
  formatShortDate,
  relativeDay,
  startOfMonth,
  todayAr,
  WEEKDAY_LABELS,
} from '../../utils/sales';
import { Chip } from '../ui/Chip';
import { Alert } from '../ui/Alert';
import { INPUT_CLASS, LABEL_CLASS, LABEL_TEXT_CLASS } from '../ui/formStyles';
import { BarList, ColumnChart } from './charts';
import { describeApiError, useAdminSession } from './adminSession';

interface Range {
  from: string;
  to: string;
}

function presets(today: string): { label: string; range: Range }[] {
  const lastMonth = addDays(startOfMonth(today), -1);
  return [
    { label: 'Hoy', range: { from: today, to: today } },
    { label: 'Últimos 7 días', range: { from: addDays(today, -6), to: today } },
    { label: 'Este mes', range: { from: startOfMonth(today), to: today } },
    { label: 'Mes pasado', range: { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) } },
    { label: 'Últimos 90 días', range: { from: addDays(today, -89), to: today } },
    { label: 'Este año', range: { from: `${today.slice(0, 4)}-01-01`, to: today } },
  ];
}

function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '0%';
}

/** Lunes primero: es como se piensa la semana en un comercio. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function AdminReports() {
  const session = useAdminSession();
  const today = todayAr();
  const [range, setRange] = useState<Range>({ from: startOfMonth(today), to: today });
  const [report, setReport] = useState<SalesReport | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    fetchSalesReport(range.from, range.to, session.password)
      .then((data) => {
        if (!isCurrent) return;
        setReport(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (isCurrent) setError(describeApiError(err, session, 'No se pudo armar el reporte.'));
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [range, session]);

  function changeRange(next: Range) {
    setLoading(true);
    setRange(next);
  }

  const options = presets(today);

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros: una sola fila arriba de todo, y todo lo de abajo responde al mismo período. */}
      <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Período">
          {options.map((option) => (
            <Chip
              key={option.label}
              isActive={range.from === option.range.from && range.to === option.range.to}
              onClick={() => changeRange(option.range)}
            >
              {option.label}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <label className={LABEL_CLASS}>
            <span className={LABEL_TEXT_CLASS}>Desde</span>
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => e.target.value && changeRange({ ...range, from: e.target.value })}
              className={INPUT_CLASS}
            />
          </label>
          <label className={LABEL_CLASS}>
            <span className={LABEL_TEXT_CLASS}>Hasta</span>
            <input
              type="date"
              value={range.to}
              min={range.from}
              max={today}
              onChange={(e) => e.target.value && changeRange({ ...range, to: e.target.value })}
              className={INPUT_CLASS}
            />
          </label>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {!report ? (
        isLoading && <p className="py-10 text-center text-sm text-stone-600">Armando el reporte…</p>
      ) : (
        // Mientras recarga se deja el reporte anterior atenuado: sin saltos ni pantallas vacías.
        <div className={`flex flex-col gap-4 transition-opacity ${isLoading ? 'opacity-50' : ''}`} aria-busy={isLoading}>
          <ReportBody report={report} />
        </div>
      )}
    </div>
  );
}

function ReportBody({ report }: { report: SalesReport }) {
  const { totals, previous } = report;
  const isSingleDay = report.from === report.to;
  const delta = previous.revenue > 0 ? (totals.revenue - previous.revenue) / previous.revenue : null;
  const margin = totals.revenue > 0 && totals.costCoverage > 0 ? totals.profit / (totals.revenue * totals.costCoverage) : null;

  if (totals.salesCount === 0 && totals.collected === 0) {
    return (
      <div className="rounded-lg border border-dashed border-stone-300 px-4 py-10 text-center">
        <p className="text-sm font-semibold text-stone-700">No hay ventas en este período.</p>
        <p className="mt-1 text-xs text-stone-600">Elegí otro período o cargá ventas en la pestaña Ventas.</p>
      </div>
    );
  }

  const unitNoun = report.granularity === 'day' ? 'día' : 'mes';
  const points = report.series.map((p) => ({
    key: p.key,
    label: report.granularity === 'day' ? formatShortDate(p.key) : formatMonthLabel(p.key).slice(0, 3),
    longLabel: report.granularity === 'day' ? formatDayLabel(p.key) : formatMonthLabel(p.key),
    value: p.revenue,
    detail: `${plural(p.salesCount, 'venta', 'ventas')} · ${plural(p.units, 'prenda', 'prendas')}`,
  }));

  return (
    <>
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile
          label="Vendido"
          value={formatCurrency(totals.revenue)}
          detail={
            delta !== null ? (
              <span className={delta >= 0 ? 'text-stock-in' : 'text-red-700'}>
                {delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta * 100))}% vs. período anterior
              </span>
            ) : (
              'Sin ventas en el período anterior'
            )
          }
        />
        <StatTile label="Ventas" value={String(totals.salesCount)} detail={plural(totals.units, 'prenda', 'prendas')} />
        <StatTile label="Ticket promedio" value={formatCurrency(totals.avgTicket)} detail={`${totals.salesCount > 0 ? (totals.units / totals.salesCount).toFixed(1).replace('.', ',') : 0} prendas por venta`} />
        <StatTile label="Clientas nuevas" value={String(totals.newClients)} detail="Primera compra en el período" />
        <StatTile label="Cobrado" value={formatCurrency(totals.collected)} detail="Plata que entró en el período" />
        <StatTile
          label="Por cobrar"
          value={formatCurrency(totals.pendingBalance)}
          detail="De las ventas de este período"
          tone={totals.pendingBalance > 0 ? 'warning' : undefined}
        />
        <StatTile
          label="Ganancia estimada"
          value={totals.costCoverage > 0 ? formatCurrency(totals.profit) : '—'}
          detail={
            totals.costCoverage === 0
              ? 'Cargá los costos en Configuración → Ventas'
              : `Margen ${margin !== null ? Math.round(margin * 100) : 0}% · sobre el ${percent(totals.costCoverage, 1)} de lo vendido`
          }
        />
        <StatTile
          label="Descuentos"
          value={formatCurrency(totals.discount)}
          detail={totals.revenue > 0 ? `${percent(totals.discount, totals.revenue + totals.discount)} de lo facturado` : undefined}
        />
      </dl>

      {!isSingleDay && (
        <Card title={report.granularity === 'day' ? 'Vendido por día' : 'Vendido por mes'}>
          <ColumnChart
            points={points}
            formatValue={formatCurrency}
            ariaLabel={`Vendido por ${unitNoun}`}
            unitNoun={unitNoun}
          />
          <details className="mt-2 text-sm">
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-xs font-semibold text-brand-700">
              Ver como tabla
            </summary>
            <table className="mt-1 w-full text-left text-xs">
              <thead className="text-stone-600">
                <tr>
                  <th className="py-1 font-semibold">{report.granularity === 'day' ? 'Día' : 'Mes'}</th>
                  <th className="py-1 text-right font-semibold">Ventas</th>
                  <th className="py-1 text-right font-semibold">Prendas</th>
                  <th className="py-1 text-right font-semibold">Vendido</th>
                </tr>
              </thead>
              <tbody className="tabular-nums text-stone-800">
                {report.series.map((p, i) => (
                  <tr key={p.key} className="border-t border-stone-100">
                    <td className="py-1">{points[i].longLabel}</td>
                    <td className="py-1 text-right">{p.salesCount}</td>
                    <td className="py-1 text-right">{p.units}</td>
                    <td className="py-1 text-right">{formatCurrency(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Por canal">
          <BarList
            ariaLabel="Vendido por canal"
            items={report.byChannel.map((c) => ({
              key: c.channel,
              label: CHANNEL_LABELS[c.channel],
              value: c.revenue,
              valueLabel: `${formatCurrency(c.revenue)} · ${percent(c.revenue, totals.revenue)}`,
              detail: `${plural(c.salesCount, 'venta', 'ventas')} · ${plural(c.units, 'prenda', 'prendas')}`,
            }))}
          />
        </Card>

        <Card title="Cobrado por medio de pago" hint="Por la fecha de cada cobro: es lo que tendría que haber en cada caja o cuenta.">
          {report.byPaymentMethod.length === 0 ? (
            <p className="text-sm text-stone-600">No entró plata en este período.</p>
          ) : (
            <BarList
              ariaLabel="Cobrado por medio de pago"
              items={report.byPaymentMethod.map((m) => ({
                key: m.methodId,
                label: m.label,
                value: m.amount,
                valueLabel: `${formatCurrency(m.amount)} · ${percent(m.amount, totals.collected)}`,
                detail: `${m.count} cobro${m.count === 1 ? '' : 's'}`,
              }))}
            />
          )}
        </Card>

        {!isSingleDay && (
          <Card title="Por día de la semana" hint="Sirve para saber qué días conviene tener más gente o hacer lives.">
            <BarList
              ariaLabel="Vendido por día de la semana"
              items={WEEK_ORDER.map((weekday) => {
                const row = report.byWeekday.find((w) => w.weekday === weekday);
                return {
                  key: String(weekday),
                  label: WEEKDAY_LABELS[weekday],
                  value: row?.revenue ?? 0,
                  valueLabel: formatCurrency(row?.revenue ?? 0),
                };
              })}
            />
          </Card>
        )}

        {(report.bySeller.length > 1 || (report.bySeller[0] && report.bySeller[0].seller !== 'Sin asignar')) && (
          <Card title="Por vendedora">
            <BarList
              ariaLabel="Vendido por vendedora"
              items={report.bySeller.map((s) => ({
                key: s.seller,
                label: s.seller,
                value: s.revenue,
                valueLabel: `${formatCurrency(s.revenue)} · ${percent(s.revenue, totals.revenue)}`,
                detail: `${plural(s.salesCount, 'venta', 'ventas')} · ${plural(s.units, 'prenda', 'prendas')}`,
              }))}
            />
          </Card>
        )}

        {report.byCategory.length > 0 && (
          <Card title="Por categoría">
            <BarList
              ariaLabel="Vendido por categoría"
              items={report.byCategory.map((c) => ({
                key: c.category,
                label: c.category,
                value: c.revenue,
                valueLabel: `${formatCurrency(c.revenue)} · ${c.units} u.`,
              }))}
            />
          </Card>
        )}
      </div>

      <Card title="Productos más vendidos" hint="Ordenados por prendas vendidas.">
        <div className="-mx-3 overflow-x-auto px-3">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="text-xs text-stone-600">
              <tr>
                <th className="py-1.5 font-semibold">Producto</th>
                <th className="py-1.5 text-right font-semibold">Prendas</th>
                <th className="py-1.5 text-right font-semibold">Vendido</th>
                <th className="py-1.5 text-right font-semibold">Ganancia</th>
              </tr>
            </thead>
            <tbody className="tabular-nums text-stone-800">
              {report.topProducts.map((p) => (
                <tr key={p.key} className="border-t border-stone-100">
                  <td className="py-1.5 pr-2">{p.name}</td>
                  <td className="py-1.5 text-right font-semibold">{p.units}</td>
                  <td className="py-1.5 text-right">{formatCurrency(p.revenue)}</td>
                  <td className="py-1.5 text-right">
                    {p.profit !== null ? formatCurrency(p.profit) : <span className="text-stone-600">sin costo</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Mejores clientas" hint="Las que más compraron en el período.">
        {report.topClients.length === 0 ? (
          <p className="text-sm text-stone-600">
            Las ventas de este período no tienen clienta asignada. Elegila al cargar la venta para ver este ranking.
          </p>
        ) : (
          <div className="-mx-3 overflow-x-auto px-3">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="text-xs text-stone-600">
                <tr>
                  <th className="py-1.5 font-semibold">Clienta</th>
                  <th className="py-1.5 text-right font-semibold">Compras</th>
                  <th className="py-1.5 text-right font-semibold">Prendas</th>
                  <th className="py-1.5 text-right font-semibold">Vendido</th>
                  <th className="py-1.5 text-right font-semibold">Última</th>
                </tr>
              </thead>
              <tbody className="tabular-nums text-stone-800">
                {report.topClients.map((c) => (
                  <tr key={c.key} className="border-t border-stone-100">
                    <td className="py-1.5 pr-2">{c.name}</td>
                    <td className="py-1.5 text-right">{c.salesCount}</td>
                    <td className="py-1.5 text-right">{c.units}</td>
                    <td className="py-1.5 text-right font-semibold">{formatCurrency(c.revenue)}</td>
                    <td className="whitespace-nowrap py-1.5 pl-2 text-right text-stone-600">{relativeDay(c.lastDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function StatTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  tone?: 'warning';
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <dt className="text-xs font-semibold text-stone-600">{label}</dt>
      <dd className={`mt-0.5 font-heading text-xl font-semibold ${tone === 'warning' ? 'text-stock-low' : 'text-stone-900'}`}>
        {value}
      </dd>
      {detail && <dd className="mt-0.5 text-xs text-stone-600">{detail}</dd>}
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-stone-200 bg-white p-3">
      <h2 className="font-heading text-sm font-semibold text-stone-900">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-stone-600">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}
