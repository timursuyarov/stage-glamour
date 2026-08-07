import request from "@/services";
import { useQuery } from "react-query";
import type { Good, SAPSyncInfo } from "@/types/wms";

/** Price entry in API response */
export interface ItemPriceDto {
  priceList: number;
  price: number;
  currency: string | null;
}

export interface ItemBatchDto {
  batchNumber: string;
  manufactureDate: string | null;
  expiryDate: string | null;
}

/** Backend item (API response shape – camelCase) */
export interface ItemDto {
  itemCode: string;
  smartupCode?: string | null;
  itemName: string;
  foreignName: string | null;
  itemsGroupCode: number;
  itemGroup: string;
  barCode: string | null;
  itemType: string;
  quantityPerPackage: number | null;
  batches: ItemBatchDto[];
  prices?: ItemPriceDto[];
  U_Shelf: string | null;
  /** Items physically in the warehouse (SAP: OnHand) */
  totalOnHand?: number;
  /** Items reserved for open sales orders — in warehouse but promised to customers (SAP: IsCommited) */
  totalCommitted?: number;
  /** Items ordered from supplier but not yet received, in transit (SAP: OnOrder) */
  totalOnOrder?: number;
  /** Items you can actually sell/use right now (SAP: calculated) */
  totalAvailable?: number;
}

export interface ItemsResponse {
  items: ItemDto[];
  total?: number;
}

export interface ItemsFilters {
  ItemCode?: string;
  ItemCodes?: string;
  ItemName?: string;
  ItemsGroupCode?: string | number;
  /** Page size (default from backend or 20) */
  PageSize?: number;
  /** Skip for pagination (offset) */
  Skip?: number;
}

function mapItemToGood(dto: ItemDto): Good {
  const itemCode = dto.itemCode ?? "";
  const now = new Date().toISOString();
  const syncInfo: SAPSyncInfo = {
    synced: true,
    sapId: itemCode,
    lastSyncAt: now,
  };
  return {
    id: itemCode,
    sku: itemCode,
    smartupCode: dto.smartupCode ?? null,
    barcode: dto.barCode ?? "",
    name: dto.itemName ?? "",
    category: dto.itemGroup ?? "",
    batchNumber: dto.batches?.[0]?.batchNumber ?? "",
    isActive: true,
    syncInfo,
    totalOnHand: dto.totalOnHand ?? 0,
    totalCommitted: dto.totalCommitted ?? 0,
    totalOnOrder: dto.totalOnOrder ?? 0,
    totalAvailable: dto.totalAvailable ?? 0,
  };
}

const fetchItems = async (
  filters?: ItemsFilters
): Promise<{ items: Good[]; total?: number }> => {
  const params = new URLSearchParams();
  params.set("WarehouseCode", "tosh_s");
  if (filters?.ItemCode) params.set("ItemCode", filters.ItemCode);
  if (filters?.ItemCodes) params.set("ItemCodes", filters.ItemCodes);
  if (filters?.ItemName) params.set("ItemName", filters.ItemName);
  if (filters?.ItemsGroupCode != null)
    params.set("ItemsGroupCode", String(filters.ItemsGroupCode));
  if (filters?.PageSize != null) params.set("PageSize", String(filters.PageSize));
  if (filters?.Skip != null) params.set("Skip", String(filters.Skip));

  const query = params.toString() ? `?${params.toString()}` : "";
  const { data } = await request.get<ItemsResponse>(`/items${query}`);
  const items = (data?.items ?? []).map(mapItemToGood);
  return { items, total: data?.total };
};

export const useItems = (filters?: ItemsFilters) => {
  return useQuery({
    queryKey: ["items", filters ?? {}],
    queryFn: () => fetchItems(filters),
    refetchOnWindowFocus: false,
    enabled: true,
  });
};
