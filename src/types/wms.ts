// WMS Core Types

export type OrderStatus = 'created' | 'validated' | 'collected' | 'shipped';
export type ReturnCondition = 'good' | 'damaged' | 'quarantine';
export type DocumentType = 'order' | 'return' | 'transfer' | 'admission' | 'inventory';
export type AdmissionStatus = 'pending' | 'processing' | 'blocked' | 'completed';

export interface Admission {
  id: string;
  documentNumber: string;
  supplierId: string;
  supplierName: string;
  expectedDate: string;
  status: AdmissionStatus;
  items: AdmissionItem[];
  tsdId?: string;
  assignedEmployeeId?: number | null;
  container?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdmissionItem {
  id: string;
  sku?: string;
  itemCode?: string;
  smartupCode?: string | null;
  name: string;
  quantity: number;
  remainingOpenQuantity?: number;
  actualQty: number;
  unitPrice?: number;
  lineTotal?: number;
  lineNum?: number;
  warehouseCode?: string | null;
  quantityPerPackage?: number;
  expiryDate?: string;
  manufacturingDate?: string;
  addmisionDate?: string;
  cellLocation?: string;
  barcode: string;
  status: 'pending' | 'received' | 'mismatch';
  /** True for the leftover (remainder) row produced by splitting a non-box-divisible quantity. */
  isLeftover?: boolean;
  /** Recommended bin (N-zone UDF) absEntry; backend may populate later. Used to preselect the full-box row's cell. */
  recommendedBinAbsEntry?: number | null;
  /** Human-readable code for the recommended bin, shown as a hint. */
  recommendedBinCode?: string | null;
}

export interface SAPSyncInfo {
  synced: boolean;
  lastSyncAt: string;
  sapId: string;
}

export interface Order {
  id: string;
  sapOrderId: string;
  customerId: string;
  customerName: string;
  status: OrderStatus;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  syncInfo: SAPSyncInfo;
  assignedTsdId?: string;
  validatedBy?: string;
  validatedAt?: string;
}

export interface OrderItem {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  sapQty: number;
  tsdQty?: number;
  cellLocation: string;
}

export interface ValidationTask {
  id: string;
  orderId: string;
  order: Order;
  status: 'pending' | 'approved' | 'rejected';
  discrepancies: DiscrepancyItem[];
  validatorId?: string;
  validatedAt?: string;
  notes?: string;
}

export interface DiscrepancyItem {
  itemId: string;
  sku: string;
  name: string;
  sapQty: number;
  tsdQty: number;
  difference: number;
}

export interface Return {
  id: string;
  originalOrderId: string;
  originalOrder: Order;
  items: ReturnItem[];
  status: 'draft' | 'pending' | 'approved' | 'completed';
  createdAt: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface ReturnItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  maxQuantity: number;
  condition: ReturnCondition;
  targetCell?: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  zones: Zone[];
}

export interface Zone {
  id: string;
  name: string;
  code: string;
  type: 'storage' | 'buffer' | 'abgd' | 'quarantine';
  cells: Cell[];
}

export interface Cell {
  id: string;
  code: string;
  zoneId: string;
  type: 'standard' | 'picking' | 'bulk';
  capacity: number;
  occupancy: number;
  items: CellItem[];
}

export interface CellItem {
  sku: string;
  barcode: string;
  quantity: number;
}

export interface Employee {
  id: string;
  uniqueId: string;
  name: string;
  role: 'executor' | 'validator' | 'returner';
  isActive: boolean;
  performanceScore: number;
  assignedTsdId?: string;
}

export interface Good {
  id: string;
  sku: string;
  smartupCode?: string | null;
  barcode: string;
  name: string;
  category: string;
  batchNumber: string;
  isActive: boolean;
  syncInfo: SAPSyncInfo;
  /** Items physically in the warehouse (SAP: OnHand) */
  totalOnHand: number;
  /** Items reserved for open sales orders — in warehouse but promised to customers (SAP: IsCommited) */
  totalCommitted: number;
  /** Items ordered from supplier but not yet received, in transit (SAP: OnOrder) */
  totalOnOrder: number;
  /** Items you can actually sell/use right now (SAP: calculated) */
  totalAvailable: number;
}

export interface InventorySession {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'cancelled';
  zones: string[];
  startedAt: string;
  completedAt?: string;
  items: InventoryItem[];
  correctionDocumentId?: string;
}

export interface InventoryItem {
  sku: string;
  name: string;
  cellCode: string;
  systemStock: number;
  physicalStock: number;
  difference: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actionType: 'create' | 'edit' | 'status_change' | 'delete' | 'approve' | 'reject';
  module: DocumentType;
  documentId: string;
  sapId?: string;
  description: string;
  previousValue?: string;
  newValue?: string;
}

export interface Transfer {
  id: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  items: TransferItem[];
  status: 'draft' | 'pending' | 'in_transit' | 'completed';
  createdAt: string;
  createdBy: string;
  confirmedByTsd: boolean;
}

export interface TransferItem {
  sku: string;
  name: string;
  quantity: number;
  sourceCell: string;
  destinationCell?: string;
}

export interface Relocation {
  id: string;
  type: 'abgd_fill';
  sourceZone: string;
  items: RelocationItem[];
  status: 'pending' | 'in_progress' | 'completed';
  assignedTsdId?: string;
  createdAt: string;
}

export interface RelocationItem {
  sku: string;
  name: string;
  quantity: number;
  sourceCell: string;
  targetCell: string;
  scannedAt?: string;
}
