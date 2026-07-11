import dayjs from "dayjs";

/** Local-time `YYYY-MM-DD` for today (matches baby-boo's getToday). */
export function getToday(): string {
  return dayjs().format("YYYY-MM-DD");
}

/** Local-time `YYYY-MM-DD` for the first day of the current month. */
export function startOfMonth(): string {
  return dayjs().startOf("month").format("YYYY-MM-DD");
}
