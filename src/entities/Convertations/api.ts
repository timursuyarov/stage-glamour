import request from "@/services";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { toArray } from "@/lib/utils";

/** Conversions are fetched without pagination (baby-boo uses pageSize=1000). */
export const CONVERTATIONS_PAGE_SIZE = 1000;

/** Raw row from GET /convertations/drafts. */
export interface ConversionRowRaw {
  docEntry: number;
  docCur: string;
  intConv: number;
  paymentSumBp: number;
  sapUsdToUzsRate: number;
  sapUsdToRubRate: number;
  docDate: string;
  docType: string;
  bpOrAcctName: string;
  bpOrAcctCode: string;
  status: string;
}

/** Row with the four derived rate cells the tables display. */
export interface ConversionRow extends ConversionRowRaw {
  rubRate: number | "";
  crossRate: number | "";
  usdRate: number | "";
  paymSumCrosUsd: number | "";
}

export interface ConversionsFilters {
  /** "NOT_UPLOADED" | "UPLOADED" */
  status: string;
  docType?: string;
  bpName?: string;
  startDate?: string;
  endDate?: string;
  /** docCur */
  currency?: string;
}

/**
 * Derive the display rate cells from a raw row. Non-RUB/USD cells are blank.
 * Note: baby-boo divides `paymSumCrosUsd` by the raw server `crossRate`; we use
 * the locally computed one to avoid NaN when the server omits it.
 */
export const mapConversionRow = (item: ConversionRowRaw): ConversionRow => {
  const rubRate = item.docCur === "RUB" ? item.intConv / item.paymentSumBp : "";
  const crossRate =
    item.docCur === "RUB" && rubRate ? item.sapUsdToUzsRate / rubRate : "";
  const usdRate =
    item.docCur === "USD"
      ? item.intConv / item.paymentSumBp
      : item.sapUsdToUzsRate;
  const paymSumCrosUsd =
    item.docCur === "RUB" && crossRate
      ? item.paymentSumBp / crossRate
      : item.paymentSumBp;
  return { ...item, rubRate, crossRate, usdRate, paymSumCrosUsd };
};

const fetchConvertations = async (
  f: ConversionsFilters,
): Promise<ConversionRow[]> => {
  const bp = encodeURIComponent(f.bpName ?? "");
  let url =
    `/convertations/drafts?docType=${f.docType ?? ""}&status=${f.status}` +
    `&bpOrAcctName=${bp}&bpOrAcctCode=${bp}` +
    `&skip=0&pageSize=${CONVERTATIONS_PAGE_SIZE}`;
  if (f.startDate !== undefined) url += `&startDate=${f.startDate}`;
  if (f.endDate !== undefined) url += `&endDate=${f.endDate}`;
  if (f.currency !== undefined) url += `&docCur=${f.currency}`;
  const { data } = await request.get<unknown>(url);
  return toArray<ConversionRowRaw>(data).map(mapConversionRow);
};

export const useConvertations = (f: ConversionsFilters) =>
  useQuery({
    queryKey: ["convertations", f],
    queryFn: () => fetchConvertations(f),
    keepPreviousData: true,
    refetchOnWindowFocus: false,
  });

// ─── Mutations ───────────────────────────────────────────────────────────────
/** POST body row (u_-prefixed). */
export interface CreateConversionRow {
  lineId: number;
  u_DocType: string;
  u_BPOrAcctCode: string;
  u_BPOrAcctName: string;
  u_DocCur: string;
  u_IntConv: string;
  u_PaymentSumBP: string;
  u_CrossRate: number | string;
  u_RubRate: number | string;
  u_UsdRate: number | string;
  u_PaymSumCrosUsd: number | string;
  u_SapUsdToUzsRate: number | null;
  u_SapUsdToRubRate: number | null;
  u_Status: string;
  u_DocDate: string;
}

/** PATCH body row (unprefixed). */
export interface UpdateConversionRow {
  docEntry: number;
  docDate: string;
  docType: string;
  bpOrAcctCode: string;
  bpOrAcctName: string;
  docCur: string;
  intConv: string;
  paymentSumBp: string;
  crossRate: number | string;
  rubRate: number | string;
  usdRate: number | string;
  paymSumCrosUsd: number | string;
  sapUsdToUzsRate: number | null;
  sapUsdToRubRate: number | null;
  status: string;
}

/** upload-to-sap body row. */
export interface SapConversionRow {
  docEntry: number;
  docType: string;
  bpOrAcctCode: string;
  docCur: string;
  intConv: string;
  paymentSumBp: string;
  crossRate: number | string;
  usdRate: number | string;
  docDate: string;
}

const invalidate = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ queryKey: ["convertations"] });

export const useCreateConversion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (row: CreateConversionRow) =>
      request.post("/convertations/drafts", [row]),
    onSuccess: () => invalidate(queryClient),
  });
};

export const useUpdateConversion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (row: UpdateConversionRow) =>
      request.patch("/convertations/drafts", [row]),
    onSuccess: () => invalidate(queryClient),
  });
};

export const useDeleteConversion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (docEntry: number) =>
      request.delete("/convertations/drafts", {
        data: [{ docEntry }],
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => invalidate(queryClient),
  });
};

export const useUploadConversionsToSap = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rows: SapConversionRow[]) =>
      request.post("/convertations/drafts/upload-to-sap", rows),
    onSuccess: () => invalidate(queryClient),
  });
};
