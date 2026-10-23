/**
 * Fechas de venta. Se guardan como texto `AAAA-MM-DD` (fecha calendario de Argentina) y no como
 * un instante: "la venta del martes" es del martes aunque se haya cargado a las 23:30, y con un
 * instante en UTC esa venta caería en el miércoles al agrupar por día.
 */

const AR_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha calendario en Argentina de un instante dado (por defecto, ahora). */
export function toArDate(value: Date | string = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return AR_DATE.format(Number.isNaN(date.getTime()) ? new Date() : date);
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Cantidad de días entre dos fechas, contando ambas puntas. */
export function daysInRange(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000) + 1;
}

/** 0 = domingo … 6 = sábado. */
export function weekdayOf(date: string): number {
  return toUtc(date).getUTCDay();
}

export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

export function eachMonth(from: string, to: string): string[] {
  const months: string[] = [];
  let [year, month] = from.slice(0, 7).split('-').map(Number);
  const last = to.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    months.push(key);
    if (key >= last) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}
