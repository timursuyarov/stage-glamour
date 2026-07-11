import request from "@/services";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { toArray } from "@/lib/utils";

export interface DashboardAccount {
  acctCode: string;
  acctName: string;
  currTotal: number;
  docCurr: string;
  docDate: string;
}

export interface ExchangeRateRow {
  code: number | string;
  u_Bank: string;
  u_USDtoUZS: number;
  u_RUBLtoUZS: number;
  u_USDtoRUBL: number;
  u_TotalSumInUSD: number;
  u_TotalSumInRUBL: number;
}

export interface BankOption {
  value: string;
  name: string;
}

export interface UpdateExchangeRateBody {
  code: string;
  u_Bank: string;
  u_USDtoUZS: number;
  u_RUBLtoUZS: number;
}

// ─── Accounts cards ──────────────────────────────────────────────────────────
const fetchDashboardAccounts = async (): Promise<DashboardAccount[]> => {
  const { data } = await request.get<unknown>("/dashboard/accounts");
  return toArray<DashboardAccount>(data);
};

export const useDashboardAccounts = () =>
  useQuery({
    queryKey: ["dashboard", "accounts"],
    queryFn: fetchDashboardAccounts,
    refetchOnWindowFocus: false,
  });

// ─── Exchange rates ──────────────────────────────────────────────────────────
const fetchExchangeRates = async (date: string): Promise<ExchangeRateRow[]> => {
  const { data } = await request.get<unknown>(
    `/dashboard/exchange-rates?date=${date}`,
  );
  return toArray<ExchangeRateRow>(data);
};

export const useExchangeRates = (date: string) =>
  useQuery({
    queryKey: ["dashboard", "exchange-rates", date],
    queryFn: () => fetchExchangeRates(date),
    refetchOnWindowFocus: false,
  });

// ─── Banks (ChangeRate dialog) ───────────────────────────────────────────────
const fetchBanks = async (): Promise<BankOption[]> => {
  const { data } = await request.get<unknown>("/dashboard/banks");
  return toArray<BankOption>(data);
};

export const useBanks = () =>
  useQuery({
    queryKey: ["dashboard", "banks"],
    queryFn: fetchBanks,
    refetchOnWindowFocus: false,
  });

// ─── Update rate (PATCH) ─────────────────────────────────────────────────────
export const useUpdateExchangeRate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateExchangeRateBody) =>
      request.patch("/dashboard/exchange-rates", body),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["dashboard", "exchange-rates"],
      }),
  });
};
