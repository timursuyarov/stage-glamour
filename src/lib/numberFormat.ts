/**
 * Format a number with space thousands separators (French locale grouping),
 * e.g. 1234567.89 -> "1 234 567,89". Used for money / exchange-rate columns.
 * Ported verbatim from baby-boo-accountant's `numberWithSpacesIntl`.
 */
export function numberWithSpacesIntl(value: number | string | null | undefined): string {
  const n = Number(value);
  return new Intl.NumberFormat("fr-FR").format(Number.isFinite(n) ? n : 0);
}

/**
 * Like {@link numberWithSpacesIntl} but always with 2 decimal places — used for
 * exchange-rate and total columns (e.g. "1 234,50").
 */
export function numberWithSpaces2(value: number | string | null | undefined): string {
  const n = Number(value);
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}
