import request from "@/services";
import { useMutation, useQuery, useQueryClient } from "react-query";

/**
 * Maintenance API over the datasets the backend stores exclusively in
 * PostgreSQL. These endpoints never touch SAP — SAP-owned documents (sales
 * orders, deliveries, invoices, credit memos, stock transfers) are not
 * mirrored locally and cannot be deleted here.
 */

export const LOCAL_DATA_ENTITY_VALUES = {
  PickLists: 1,
  OrdersCheckingRequests: 2,
  TransferRequirements: 3,
  ReturnCheckingRequestLines: 4,
  InventoryRequestGroups: 5,
  BonusRecords: 6,
} as const;

export type LocalDataEntity =
  (typeof LOCAL_DATA_ENTITY_VALUES)[keyof typeof LOCAL_DATA_ENTITY_VALUES];

export const LOCAL_DATA_ENTITY_LABELS: Record<number, string> = {
  1: "localData.entityPickLists",
  2: "localData.entityOrdersCheckingRequests",
  3: "localData.entityTransferRequirements",
  4: "localData.entityReturnCheckingRequestLines",
  5: "localData.entityInventoryRequestGroups",
  6: "localData.entityBonusRecords",
};

/** Preview page size. The delete always affects every matching row, not just this page. */
export const PAGE_SIZE = 20;

// --- Entity discovery ---
export interface LocalDataEntityInfo {
  entity: LocalDataEntity;
  table: string;
  rowCount: number;
  cascadesInto: string[];
  origin: string;
  note: string;
}

const fetchLocalDataEntities = async (): Promise<LocalDataEntityInfo[]> => {
  const { data } = await request.get<LocalDataEntityInfo[]>("/local-data/entities");
  return Array.isArray(data) ? data : [];
};

export const useLocalDataEntities = () => {
  return useQuery({
    queryKey: ["local-data-entities"],
    queryFn: fetchLocalDataEntities,
    refetchOnWindowFocus: false,
  });
};

// --- Preview ---
export interface LocalDataRow {
  id: number;
  summary: string;
  createdAt: string | null;
  childCount: number;
}

export interface LocalDataPreview {
  entity: LocalDataEntity;
  totalCount: number;
  items: LocalDataRow[];
}

export interface LocalDataFilters {
  Entity: LocalDataEntity;
  Ids?: number[];
  From?: string;
  To?: string;
  Skip?: number;
  Take?: number;
}

/**
 * Builds the query string shared by the preview and the delete. Both must use
 * the identical filter, otherwise the count the user confirms is not the count
 * that gets deleted.
 */
function buildParams(filters: LocalDataFilters): URLSearchParams {
  const params = new URLSearchParams();
  params.set("Entity", String(filters.Entity));
  if (filters.From) params.set("From", filters.From);
  if (filters.To) params.set("To", filters.To);
  // Repeated key — the backend binds this to List<long>.
  filters.Ids?.forEach((id) => params.append("Ids", String(id)));
  return params;
}

const fetchLocalDataPreview = async (
  filters: LocalDataFilters
): Promise<LocalDataPreview> => {
  const params = buildParams(filters);
  if (filters.Skip != null) params.set("Skip", String(filters.Skip));
  params.set("Take", String(filters.Take ?? PAGE_SIZE));
  const { data } = await request.get<LocalDataPreview>(
    `/local-data?${params.toString()}`
  );
  return data;
};

export const useLocalDataPreview = (filters: LocalDataFilters | null) => {
  return useQuery({
    queryKey: ["local-data-preview", filters],
    queryFn: () => fetchLocalDataPreview(filters!),
    enabled: filters != null,
    refetchOnWindowFocus: false,
  });
};

// --- Delete ---
export interface LocalDataDeleteResult {
  entity: LocalDataEntity;
  deletedCount: number;
  cascadedCounts: Record<string, number>;
}

export interface LocalDataDeleteBody {
  filters: LocalDataFilters;
  /**
   * Required only for an unscoped purge (no ids and no date range). The backend
   * rejects such a request with LocalData.NoFilterSupplied otherwise.
   */
  confirmDeleteAll?: boolean;
}

const deleteLocalData = async ({
  filters,
  confirmDeleteAll,
}: LocalDataDeleteBody): Promise<LocalDataDeleteResult> => {
  const params = buildParams(filters);
  if (confirmDeleteAll) params.set("confirmDeleteAll", "true");
  const { data } = await request.delete<LocalDataDeleteResult>(
    `/local-data?${params.toString()}`
  );
  return data;
};

export const useDeleteLocalData = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LocalDataDeleteBody) => deleteLocalData(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["local-data-entities"] });
      queryClient.invalidateQueries({ queryKey: ["local-data-preview"] });
      // Also refresh the feature lists these rows are shown on, so a row
      // deleted from a page disappears without a manual reload.
      queryClient.invalidateQueries({ queryKey: ["required-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["picklists"] });
      queryClient.invalidateQueries({ queryKey: ["bonus-records-grouped"] });
      queryClient.invalidateQueries({ queryKey: ["bonus-records-detail"] });
    },
  });
};

/** True when the filter would purge an entire table, requiring explicit confirmation. */
export const isUnscoped = (filters: LocalDataFilters): boolean =>
  !filters.From && !filters.To && !(filters.Ids && filters.Ids.length > 0);
