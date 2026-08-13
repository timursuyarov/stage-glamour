import request from "@/services";
import { useMutation, useQuery, useQueryClient } from "react-query";
import type { Admission, AdmissionItem, AdmissionStatus } from "@/types/wms";

// API response types (from backend)
export interface PurchaseInvoiceDocumentLine {
  lineNum: number;
  itemCode: string | null;
  itemDescription: string | null;
  quantity: number;
  remainingOpenQuantity?: number;
  unitPrice: number;
  lineTotal: number;
  lineStatus: string;
  warehouseCode: string | null;
  measureUnit: string | null;
  quantityPerPackage?: number | null;
  smartupCode?: string | null;
  /** Recommended bin resolved from the item's N-zone UDF (U_Nzona). */
  recommendedBinAbsEntry?: number | null;
  recommendedBinCode?: string | null;
}

export interface PurchaseInvoiceItem {
  docEntry: number;
  docNum: number;
  docDate: string;
  docDueDate: string;
  cardCode: string;
  cardName: string;
  docTotal: number;
  docCurrency: string;
  documentStatus: string;
  salesPersonCode: number;
  U_IsVisible: string;
  U_Container: string | null;
  assignedEmployeeId?: number | null;
  documentLines: PurchaseInvoiceDocumentLine[];
}

export interface PurchaseInvoicesResponse {
  items: PurchaseInvoiceItem[];
}

export interface PurchaseInvoicesFilters {
  DocNum?: number;
  CardName?: string;
  StartDate?: string;
  EndDate?: string;
  /** Page index: 0 = first 20 items, 1 = items 21–40, etc. */
  skip?: number;
}

function mapDocumentStatusToAdmissionStatus(
  documentStatus: string
): AdmissionStatus {
  const s = (documentStatus || "").toLowerCase();
  if (s.includes("close") || s.includes("completed")) return "completed";
  if (s.includes("block")) return "blocked";
  if (s.includes("process")) return "processing";
  return "pending";
}

function mapDocumentLineToAdmissionItem(
  line: PurchaseInvoiceDocumentLine,
  docEntry: number
): AdmissionItem {
  const remaining = line.remainingOpenQuantity ?? line.quantity;
  return {
    id: `${docEntry}-${line.lineNum}`,
    itemCode: line.itemCode ?? "",
    smartupCode: line.smartupCode ?? null,
    name: line.itemDescription ?? "",
    quantity: line.quantity,
    remainingOpenQuantity: remaining,
    actualQty: remaining,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
    lineNum: line.lineNum,
    warehouseCode: line.warehouseCode ?? undefined,
    quantityPerPackage: line.quantityPerPackage ?? undefined,
    recommendedBinAbsEntry: line.recommendedBinAbsEntry ?? null,
    recommendedBinCode: line.recommendedBinCode ?? null,
    barcode: "",
    status: "pending",
  };
}

function mapPurchaseInvoiceToAdmission(item: PurchaseInvoiceItem): Admission {
  const id = String(item.docEntry);
  const now = new Date().toISOString();
  return {
    id,
    documentNumber: String(item.docNum),
    supplierId: item.cardCode,
    supplierName: item.cardName,
    expectedDate: item.docDueDate?.slice(0, 10) ?? "",
    status: mapDocumentStatusToAdmissionStatus(item.documentStatus),
    assignedEmployeeId: item.assignedEmployeeId ?? null,
    container: item.U_Container ?? undefined,
    items: (item.documentLines ?? []).map((line) =>
      mapDocumentLineToAdmissionItem(line, item.docEntry)
    ),
    createdAt: item.docDate ?? now,
    updatedAt: now,
  };
}

const fetchPurchaseInvoices = async (
  filters?: PurchaseInvoicesFilters
): Promise<Admission[]> => {
  const params = new URLSearchParams();
  if (filters?.DocNum != null) params.set("DocNum", String(filters.DocNum));
  if (filters?.CardName) params.set("CardName", filters.CardName);
  if (filters?.StartDate) params.set("StartDate", filters.StartDate);
  if (filters?.EndDate) params.set("EndDate", filters.EndDate);
  const skip = filters?.skip ?? 0;
  params.set("skip", String(skip));
  const query = params.toString() ? `?${params.toString()}` : "";
  const { data } = await request.get<PurchaseInvoicesResponse>(
    `/purchase-invoices${query}`
  );
  const items = data?.items ?? [];
  return items.map(mapPurchaseInvoiceToAdmission);
};

export const usePurchaseInvoices = (filters?: PurchaseInvoicesFilters) => {
  return useQuery({
    queryKey: ["purchase-invoices", filters ?? {}],
    queryFn: () => fetchPurchaseInvoices(filters),
    refetchOnWindowFocus: false,
    enabled: true,
  });
};

// From-invoice (complete admission) request body
export interface FromInvoiceBatchNumber {
  expiryDate: string;
  manufacturingDate: string;
  addmisionDate: string;
  quantity: number;
}

export interface FromInvoiceBinAllocation {
  binAbsEntry: number;
  quantity: number;
  serialAndBatchNumbersBaseLine: number;
}

export interface FromInvoiceDocumentLine {
  itemCode: string;
  quantity: number;
  warehouseCode: string;
  baseType: number;
  baseEntry: number;
  baseLine: number;
  batchNumbers: FromInvoiceBatchNumber[];
  documentLinesBinAllocations: FromInvoiceBinAllocation[];
}

export interface FromInvoiceRequestBody {
  employeeId: number | null;
  cardCode: string;
  container: string | null;
  documentLines: FromInvoiceDocumentLine[];
}

const postFromInvoice = async (body: FromInvoiceRequestBody): Promise<unknown> => {
  const { data } = await request.post("/purchase-deliveries/from-invoice", body);
  return data;
};

export const useFromInvoiceMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postFromInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
    },
  });
};

export const useAssignEmployeeToPurchaseInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ docEntry, employeeId }: { docEntry: number; employeeId: number }) =>
      request.patch(`/purchase-invoices/${docEntry}/assign-employee`, {
        employeeId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
    },
  });
};

export const useDetachAdmissionEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (docEntry: number) =>
      request.patch(`/purchase-invoices/${docEntry}/assign-employee`, {
        employeeId: null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
    },
  });
};
