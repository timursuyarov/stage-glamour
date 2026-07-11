import request from "@/services";
import { useQuery } from "react-query";

/**
 * SAP currency rate for a given date. `Currency=SUM` returns the USD→UZS rate,
 * `Currency=руб` (literal Cyrillic) the RUB rate. Response is `{ data: <scalar> }`.
 */
const fetchCurrencyRate = async (
  currency: string,
  date: string,
): Promise<number | null> => {
  const { data } = await request.get<{ data: number }>(
    `/cashier/currency-rate?Currency=${encodeURIComponent(currency)}&Date=${date}`,
  );
  return data?.data ?? null;
};

export const useCurrencyRate = (
  currency: string,
  date: string,
  enabled = true,
) =>
  useQuery({
    queryKey: ["cashier", "currency-rate", currency, date],
    queryFn: () => fetchCurrencyRate(currency, date),
    enabled: enabled && !!date,
    refetchOnWindowFocus: false,
  });
