/**
 * Money input helpers ported from baby-boo-accountant. Two `removeSpaces`
 * variants exist on purpose — the Add-conversion flow normalises decimal commas
 * to dots, while the Edit/list flows do not (matches source behavior exactly).
 */

/** Display value for a money `<input>`: keep only digits/dot/comma, group the
 *  integer part with spaces every 3 digits. Returns "" for falsy input. */
export function formatNumberWithSpaces(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const cleaned = String(value).replace(/[^\d.,]/g, "");
  const [intPart, ...rest] = cleaned.split(/[.,]/);
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return rest.length ? `${grouped},${rest.join("")}` : grouped;
}

/** Strip spaces/symbols, keep digits and dots. (formatMoney.removeSpaces) */
export function removeSpaces(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[^\d.,]/g, "").replace(/\s/g, "");
}

/** Like {@link removeSpaces} but also converts a decimal comma to a dot.
 *  (numberWithSpaces.removeSpaces — used by the Add-conversion modal.) */
export function removeSpacesComma(value: string | number | null | undefined): string {
  return removeSpaces(value).replace(",", ".");
}

/** Currency code → display symbol. */
export function switchCurrency(currency: string | null | undefined): string {
  switch (currency) {
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "RUB":
      return "₽";
    case "SUM":
    default:
      return "so'm";
  }
}
