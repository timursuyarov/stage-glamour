import request from "@/services";
import { useQuery, useInfiniteQuery } from "react-query";
import { toArray } from "@/lib/utils";

export const PAYMENTS_PAGE_SIZE = 20;

export interface PaymentRow {
  docNum: number;
  docDate: string;
  /** "Incoming" | "Outgoing" */
  paymentType: string;
  cardName: string;
  cashSum: number;
  docCurr: string;
  u_Firma: string;
}

export interface PaymentsTotal {
  saldo: number;
  incomingPaymentsTotal: number;
  vendorPaymentsTotal: number;
}

export interface PaymentsFilters {
  startDate?: string;
  endDate?: string;
  /** "" | "Incoming" | "Outgoing" */
  paymentType?: string;
  /** "" | "A" | "C" | "S" */
  docType?: string;
  bpName?: string;
}

export interface AktSverkaRow {
  transId: number;
  dueDate: string | null;
  fcDebit: number;
  fcCredit: number;
  contraAct: string;
  contraName: string;
  cumulativeBalanceLC: number;
  cumulativeBalanceFC: number;
}

const paymentsQuery = (f: PaymentsFilters) =>
  `startDate=${f.startDate ?? ""}&endDate=${f.endDate ?? ""}&paymentType=${
    f.paymentType ?? ""
  }&docType=${f.docType ?? ""}&bpName=${encodeURIComponent(f.bpName ?? "")}`;

// ─── Loaded payments list (infinite; skip = row offset) ──────────────────────
const fetchPayments = async (
  f: PaymentsFilters,
  skip: number,
): Promise<PaymentRow[]> => {
  const { data } = await request.get<unknown>(
    `/payments/payments?${paymentsQuery(f)}&skip=${skip}&pageSize=${PAYMENTS_PAGE_SIZE}`,
  );
  return toArray<PaymentRow>(data);
};

export const usePaymentsInfinite = (f: PaymentsFilters) =>
  useInfiniteQuery(
    ["payments", "list", f],
    ({ pageParam = 0 }) => fetchPayments(f, pageParam),
    {
      getNextPageParam: (lastPage, allPages) =>
        lastPage.length >= PAYMENTS_PAGE_SIZE
          ? allPages.length * PAYMENTS_PAGE_SIZE
          : undefined,
      refetchOnWindowFocus: false,
    },
  );

// ─── Loaded payments totals ──────────────────────────────────────────────────
const fetchPaymentsTotal = async (
  f: PaymentsFilters,
): Promise<PaymentsTotal | null> => {
  const { data } = await request.get<unknown>(
    `/payments/payments-total?${paymentsQuery(f)}`,
  );
  return toArray<PaymentsTotal>(data)[0] ?? null;
};

export const usePaymentsTotal = (f: PaymentsFilters) =>
  useQuery({
    queryKey: ["payments", "total", f],
    queryFn: () => fetchPaymentsTotal(f),
    refetchOnWindowFocus: false,
  });

// ─── Act sverka (infinite; acctCode-scoped; skip = row offset) ───────────────
const fetchAktSverka = async (
  acctCode: string,
  startDate: string,
  endDate: string,
  skip: number,
): Promise<AktSverkaRow[]> => {
  const { data } = await request.get<unknown>(
    `/payments/payments-akt-sverka?acctCode=${encodeURIComponent(
      acctCode,
    )}&startDate=${startDate}&endDate=${endDate}&skip=${skip}&pageSize=${PAYMENTS_PAGE_SIZE}`,
  );
  return toArray<AktSverkaRow>(data);
};

export const useAktSverkaInfinite = (
  acctCode: string,
  startDate: string,
  endDate: string,
) =>
  useInfiniteQuery(
    ["payments", "akt-sverka", acctCode, startDate, endDate],
    ({ pageParam = 0 }) =>
      fetchAktSverka(acctCode, startDate, endDate, pageParam),
    {
      getNextPageParam: (lastPage, allPages) =>
        lastPage.length >= PAYMENTS_PAGE_SIZE
          ? allPages.length * PAYMENTS_PAGE_SIZE
          : undefined,
      enabled: !!acctCode,
      refetchOnWindowFocus: false,
    },
  );
