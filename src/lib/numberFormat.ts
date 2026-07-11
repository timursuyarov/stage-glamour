/**
 * Format a number with space thousands separators (French locale grouping),
 * e.g. 1234567.89 -> "1 234 567,89". Used for money / exchange-rate columns.
 * Ported verbatim from baby-boo-accountant's `numberWithSpacesIntl`.
 */
export function numberWithSpacesIntl(value: number | string | null | undefined): string {
  const n = Number(value);
  return new Intl.NumberFormat("fr-FR").format(Number.isFinite(n) ? n : 0);
}
