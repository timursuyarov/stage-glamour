import request from "@/services";
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "react-query";
import { toArray } from "@/lib/utils";

/** Draft list page size — the source hard-codes 20. */
export const DRAFTS_PAGE_SIZE = 20;

// ─── Types ───────────────────────────────────────────────────────────────────

/** One bank/cash-register account from the sidebar menu (`/accounts/menu`). */
export interface AccountMenuItem {
  acctCode: string;
  acctName: string;
  /** "Yes" for conversion accounts (a separate, out-of-scope feature). */
  u_IsConvertationAccount: string;
}

/** An uploaded payment draft row (`/bank-statements/uploaded-drafts`). */
export interface UploadedDraft {
  code: string;
  name: string;
  u_AddedDate: string | null;
  u_UploadStatus: string;
  u_OriginalDataID: number | string | null;
  u_ProcessedDataID: number | string | null;
}

/** A parsed original bank-statement row (`/bank-statements/bank-statements`). */
export interface OriginalRow {
  u_PaymentNum: string;
  u_CompanyName: string;
  u_PaymentDate: string;
  u_Debit: number;
  u_Credit: number;
  u_Description: string;
}

/** A processed (SAP-bound) row (`/bank-statements/bank-statements-for-sap`). */
export interface ProcessedRow {
  docEntry: number;
  docNum: number;
  lineId: number;
  u_Status: string;
  u_PaymentType: string;
  u_DocDate: string;
  /** "A" account / "C" customer / "S" supplier. */
  u_DocType: string;
  u_BPCode: string;
  u_BPName: string;
  u_AcctCode: string;
  u_AcctName: string;
  u_PaidSum: number;
  u_ExchangeRate1: number;
  u_ExchangeRate2: number;
  u_Comment: string;
  u_PaymentNum: string;
  /** "Yes" already uploaded to SAP / "No" not yet. */
  u_IsPaymentMade: string;
}

/** Business-partner search result (`/bank-statements/business-partners`). */
export interface BusinessPartner {
  cardName: string;
  cardCode: string;
  /** "A" account / "C" customer / "S" supplier. */
  cardType: string;
  /** BP currency — used by the conversion modals. */
  currency?: string;
}

/** Row shape sent to PATCH /bank-statements/bank-statements-for-sap. */
export interface SaveProcessedRow {
  docEntry: number;
  lineId: number;
  u_DocType: string;
  u_BPCode: string | null;
  u_BPName: string | null;
  u_AcctCode: string | null;
  u_AcctName: string | null;
  u_CashRegCode: string;
}

/** Row shape sent to POST .../upload-to-sap/{draftCode}. */
export interface SapUploadRow extends SaveProcessedRow {
  docNum: number;
  u_Status: string;
  u_PaymentType: string;
  u_DocDate: string;
  u_PaidSum: number;
  u_ExchangeRate1: number;
  u_ExchangeRate2: number;
  u_Comment: string;
  u_PaymentNum: string;
  u_IsPaymentMade: string;
}

// ─── Accounts menu ───────────────────────────────────────────────────────────

const fetchAccountsMenu = async (): Promise<AccountMenuItem[]> => {
  const { data } = await request.get<unknown>("/accounts/menu");
  return toArray<AccountMenuItem>(data);
};

export const useAccountsMenu = () =>
  useQuery({
    queryKey: ["accounts", "menu"],
    queryFn: fetchAccountsMenu,
    refetchOnWindowFocus: false,
  });

// ─── Uploaded drafts (infinite scroll) ───────────────────────────────────────
// In Glamour, `skip` is a raw row OFFSET passed straight to SQL OFFSET (not a
// page index) — so page N sends skip = N * pageSize.

const fetchUploadedDrafts = async (
  accountCode: string,
  skip: number,
): Promise<UploadedDraft[]> => {
  const { data } = await request.get<unknown>(
    `/bank-statements/uploaded-drafts?accountCode=${encodeURIComponent(
      accountCode,
    )}&skip=${skip}&pageSize=${DRAFTS_PAGE_SIZE}`,
  );
  return toArray<UploadedDraft>(data);
};

export const useUploadedDraftsInfinite = (accountCode: string) =>
  useInfiniteQuery(
    ["bankstatements", "uploaded-drafts", accountCode],
    ({ pageParam = 0 }) => fetchUploadedDrafts(accountCode, pageParam),
    {
      getNextPageParam: (lastPage, allPages) =>
        lastPage.length >= DRAFTS_PAGE_SIZE
          ? allPages.length * DRAFTS_PAGE_SIZE
          : undefined,
      enabled: !!accountCode,
      refetchOnWindowFocus: false,
    },
  );

// ─── Original rows ───────────────────────────────────────────────────────────

const fetchOriginalRows = async (
  docEntry: number | string,
): Promise<OriginalRow[]> => {
  const { data } = await request.get<unknown>(
    `/bank-statements/bank-statements?docEntry=${docEntry}&pageSize=1000`,
  );
  return toArray<OriginalRow>(data);
};

export const useOriginalRows = (
  docEntry: number | string | null | undefined,
  enabled: boolean,
) =>
  useQuery({
    queryKey: ["bankstatements", "original", docEntry],
    queryFn: () => fetchOriginalRows(docEntry!),
    enabled: enabled && docEntry != null,
    refetchOnWindowFocus: false,
  });

// ─── Processed rows ──────────────────────────────────────────────────────────

const fetchProcessedRows = async (
  docEntry: number | string,
): Promise<ProcessedRow[]> => {
  const { data } = await request.get<unknown>(
    `/bank-statements/bank-statements-for-sap?docEntry=${docEntry}&pageSize=1000`,
  );
  return toArray<ProcessedRow>(data);
};

export const useProcessedRows = (
  docEntry: number | string | null | undefined,
  enabled: boolean,
) =>
  useQuery({
    queryKey: ["bankstatements", "processed", docEntry],
    queryFn: () => fetchProcessedRows(docEntry!),
    enabled: enabled && docEntry != null,
    refetchOnWindowFocus: false,
  });

// ─── Business-partner search ─────────────────────────────────────────────────

const fetchBusinessPartners = async (
  cardName: string,
): Promise<BusinessPartner[]> => {
  const { data } = await request.get<unknown>(
    `/bank-statements/business-partners?cardName=${encodeURIComponent(cardName)}`,
  );
  return toArray<BusinessPartner>(data);
};

export const useBusinessPartnerSearch = (cardName: string) =>
  useQuery({
    queryKey: ["bankstatements", "business-partners", cardName],
    queryFn: () => fetchBusinessPartners(cardName),
    enabled: cardName.trim().length > 0,
    keepPreviousData: true,
    refetchOnWindowFocus: false,
  });

// ─── Mutations ───────────────────────────────────────────────────────────────

export const useUploadExcel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, file }: { code: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      return request.post(`/bank-statements/upload-excel/${code}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: (_data, { code }) =>
      queryClient.invalidateQueries({
        queryKey: ["bankstatements", "uploaded-drafts", code],
      }),
  });
};

export const useDeleteDraft = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draftCode: string) =>
      request.delete(`/bank-statements/uploaded-drafts/${draftCode}`),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["bankstatements", "uploaded-drafts"],
      }),
  });
};

export const useSaveProcessed = () =>
  useMutation({
    mutationFn: (rows: SaveProcessedRow[]) =>
      request.patch(`/bank-statements/bank-statements-for-sap`, rows),
  });

export const useUploadToSap = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      draftCode,
      rows,
    }: {
      draftCode: string;
      rows: SapUploadRow[];
    }) =>
      request.post(
        `/bank-statements/bank-statements-for-sap/upload-to-sap/${draftCode}`,
        rows,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["bankstatements", "uploaded-drafts"],
      }),
  });
};

// ─── Recommendations (infinite scroll; skip = row offset) ────────────────────
export const RECOMMENDATIONS_PAGE_SIZE = 20;

export interface RecommendationRow {
  u_DocType: string;
  u_AcctCode: string;
  u_AcctName: string;
  u_BPCode: string;
  u_BPName: string;
  u_Keyword: string;
  u_BPCurrency: string;
  docNum: number;
}

export interface RecommendationsFilters {
  /** cardCode of the selected BP/account */
  bpCode?: string;
  /** "" | "A" | "C" | "S" */
  docType?: string;
}

const fetchRecommendations = async (
  f: RecommendationsFilters,
  skip: number,
): Promise<RecommendationRow[]> => {
  const { data } = await request.get<unknown>(
    `/bank-statements/recommendations?bpCode=${encodeURIComponent(
      f.bpCode ?? "",
    )}&docType=${f.docType ?? ""}&skip=${skip}&pageSize=${RECOMMENDATIONS_PAGE_SIZE}`,
  );
  return toArray<RecommendationRow>(data);
};

export const useRecommendationsInfinite = (f: RecommendationsFilters) =>
  useInfiniteQuery(
    ["bankstatements", "recommendations", f],
    ({ pageParam = 0 }) => fetchRecommendations(f, pageParam),
    {
      getNextPageParam: (lastPage, allPages) =>
        lastPage.length >= RECOMMENDATIONS_PAGE_SIZE
          ? allPages.length * RECOMMENDATIONS_PAGE_SIZE
          : undefined,
      refetchOnWindowFocus: false,
    },
  );
