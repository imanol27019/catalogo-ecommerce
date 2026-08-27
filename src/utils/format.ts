import { CURRENCY, LOCALE } from '../config/site.config';

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}
