import request from "@/services";
import { useMutation, useQuery, useQueryClient } from "react-query";

export interface InventoryTransferRequestLine {
  lineNum: number;
  itemCode: string;
  smartupCode?: string | null;
  itemDescription: string;
  quantity: number;
  quantityPerPackage: number | null;
  fromWarehouseCode?: string;
  fromWarehouseName?: string;
  warehouseCode?: string;
  warehouseName?: string;
  uoMCode?: string;
  uoMName?: string;
  barCode?: string | null;
  batchNumber?: string | null;
  batchQuantity?: number | null;
  batchExpiryDate?: string | null;
  batchManufactureDate?: string | null;
  shelf?: string | null;
}

export interface InventoryTransferRequestItem {
  docEntry: number;
  docNum: number;
  deliveryNumber: string | null;
  assignedEmployeeId: number | null;
  docDate: string;
  docDueDate: string;
  documentStatus: string;
  comments: string | null;
  fromWarehouse: string;
  fromWarehouseName: string;
  toWarehouse: string;
  toWarehouseName: string;
  stockTransferLines: InventoryTransferRequestLine[];
}

export interface InventoryTransferRequestsResponse {
  items: InventoryTransferRequestItem[];
}

export interface InventoryTransferRequestsFilters {
  DocEntry?: number;
  DocEntries?: number[];
  DocNum?: number;
  /** Always 2 for move-to-region page, but kept configurable */
  Status?: number;
  StartDate?: string;
  EndDate?: string;
  FromWarehouseCode?: string;
  ToWarehouseCode?: string;
  CardName?: string;
  PageSize?: number;
  Skip?: number;
}

const fetchInventoryTransferRequests = async (
  filters?: InventoryTransferRequestsFilters
): Promise<InventoryTransferRequestItem[]> => {
  const params = new URLSearchParams();

  // Status is always 2 for this page unless explicitly overridden
  params.set("Status", String(filters?.Status ?? 2));

  // Always scope to the tosh_s warehouse
  params.set("WarehouseCode", "tosh_s");

  if (filters?.DocEntry != null) params.set("DocEntry", String(filters.DocEntry));
  if (filters?.DocNum != null) params.set("DocNum", String(filters.DocNum));
  if (filters?.CardName) params.set("CardName", filters.CardName);
  if (filters?.StartDate) params.set("StartDate", filters.StartDate);
  if (filters?.EndDate) params.set("EndDate", filters.EndDate);
  if (filters?.FromWarehouseCode) {
    params.set("FromWarehouseCode", filters.FromWarehouseCode);
  }
  if (filters?.ToWarehouseCode) {
    params.set("ToWarehouseCode", filters.ToWarehouseCode);
  }
  if (filters?.DocEntries && filters.DocEntries.length > 0) {
    params.set(
      "DocEntries",
      filters.DocEntries.map((n) => String(n)).join(",")
    );
  }
  if (filters?.PageSize != null) params.set("PageSize", String(filters.PageSize));
  if (filters?.Skip != null) params.set("Skip", String(filters.Skip));

  const { data } = await request.get<InventoryTransferRequestsResponse>(
    `/inventory-transfer-requests?${params.toString()}`
  );

  return data?.items ?? [];
};

export const useInventoryTransferRequests = (
  filters?: InventoryTransferRequestsFilters
) => {
  return useQuery({
    queryKey: ["inventory-transfer-requests", filters ?? {}],
    queryFn: () => fetchInventoryTransferRequests(filters),
    refetchOnWindowFocus: false,
  });
};

/** POST: submit selected docEntries (array of numbers) */
const postInventoryTransferRequests = async (
  docEntries: number[]
): Promise<unknown> => {
  const { data } = await request.post<unknown>(
    "/inventory-transfer-requests",
    docEntries
  );
  return data;
};

export const usePostInventoryTransferRequests = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postInventoryTransferRequests,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-transfer-requests"] });
    },
  });
};

export interface RegionReturnLinePayload {
  lineNum: number;
  reasonId: number;
}

/** POST: submit a region-to-region return with a reason per line */
const postRegionReturn = async (
  docEntry: number,
  lines: RegionReturnLinePayload[]
): Promise<unknown> => {
  const { data } = await request.post(`/returns/region/${docEntry}`, lines);
  return data;
};

export const useRegionReturnMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      docEntry,
      lines,
    }: {
      docEntry: number;
      lines: RegionReturnLinePayload[];
    }) => postRegionReturn(docEntry, lines),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-transfer-requests"] });
    },
  });
};

