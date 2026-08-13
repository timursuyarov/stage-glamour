import { useState, useMemo, useEffect, useRef } from "react";
import { Table, Modal, Button as AntButton, Select } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleCard } from "@/components/ui/stat-card";
import { useTranslation } from "react-i18next";
import {
  usePicklists,
  usePicklistByDocEntry,
  useAssignPicklist,
  useAssignPicklistEmployee,
  useValidationScan,
  useValidationFinalize,
  useDetachPicklist,
  useAssignValidationValidator,
  useDetachValidation,
  useValidationItems,
  type PicklistItem,
  type PicklistLine,
  type PicklistsFilters,
} from "@/entities/Picklists/api";
import { useEmployees } from "@/entities/Employees/api";
import { useRequiredTransfersByIds } from "@/entities/RequiredTransfers/api";
import { EPickListStatus, EPickListLineStatus } from "@/enums/picklist";
import { EWarehouseCheckingType } from "@/enums/warehouseChecking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, ChevronLeft, ChevronRight, X, Printer, Search } from "lucide-react";
import { useLabelPrint } from "@/features/label-print/hooks/useLabelPrint";
import { DEFAULT_LABEL_DATA } from "@/features/label-print/types/label";
import { message } from "antd";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useScannerInput } from "@/hooks/useScannerInput";

const WAREHOUSE_CHECKING_TYPE_KEYS: Record<number, string> = {
  [EWarehouseCheckingType.WarehouseToClient]: "requiredTransfers.typeWarehouseToClient",
  [EWarehouseCheckingType.WarehouseToWarehouse]: "requiredTransfers.typeWarehouseToWarehouse",
  [EWarehouseCheckingType.Return]: "requiredTransfers.typeReturn",
};

const TYPE_BADGE_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  [EWarehouseCheckingType.WarehouseToClient]: {
    bg: "bg-blue-100",
    text: "text-blue-900",
    border: "border-blue-300",
  },
  [EWarehouseCheckingType.WarehouseToWarehouse]: {
    bg: "bg-purple-100",
    text: "text-purple-900",
    border: "border-purple-300",
  },
  [EWarehouseCheckingType.Return]: {
    bg: "bg-amber-100",
    text: "text-amber-900",
    border: "border-amber-300",
  },
};

const STATUS_BADGE_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  [EPickListStatus.Draft]: {
    bg: "bg-slate-100",
    text: "text-slate-900",
    border: "border-slate-300",
  },
  [EPickListStatus.InProgress]: {
    bg: "bg-amber-100",
    text: "text-amber-900",
    border: "border-amber-300",
  },
  [EPickListStatus.Picked]: {
    bg: "bg-blue-100",
    text: "text-blue-900",
    border: "border-blue-300",
  },
  [EPickListStatus.Validated]: {
    bg: "bg-green-100",
    text: "text-green-900",
    border: "border-green-300",
  },
};

const PAGE_SIZE = 20;

interface PicklistsPageProps {
  /** Array of statuses to filter picklists (e.g. [1, 2] for collect, [3] for validation) */
  statuses: number[];
  titleKey: string;
  parentKey: string;
  /** "collect" = view only; "validation" = assign + validate actions */
  mode?: "collect" | "validation";
  /** Hide the page header (used when parent renders its own header, e.g. HistoryPage) */
  hideHeader?: boolean;
  /** When true, replaces the Javobgar section in the detail modal with a label print UI */
  printMode?: boolean;
}

export default function PicklistsPage({
  statuses,
  titleKey,
  parentKey,
  mode = "collect",
  hideHeader = false,
  printMode = false,
}: PicklistsPageProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { print: printLabelPopup } = useLabelPrint();
  const [pageIndex, setPageIndex] = useState(0);
  const [searchInput, setSearchInput] = useState<string>("");
  const [selectedDocEntry, setSelectedDocEntry] = useState<number | null>(null);
  const [deliveryPackageCount, setDeliveryPackageCount] = useState<number>(0);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [labelCopies, setLabelCopies] = useState<number>(1);
  // ID of the transferRequirementId the user clicked — drives the transfer-detail popup
  const [selectedTransferReqId, setSelectedTransferReqId] = useState<number | null>(null);
  // Pending scanner scan — line + raw barcode waiting for user confirmation
  const [pendingScan, setPendingScan] = useState<{ line: PicklistLine; barcode: string } | null>(null);
  // Whether already-validated lines stay visible in the table (default: hide them)
  const [showValidated, setShowValidated] = useState<boolean>(false);
  // Tracks the docEntry we've already set the initial showValidated for, so the
  // "open with everything confirmed → show" default runs once per open, not on
  // every line change.
  const showValidatedInitDocEntry = useRef<number | null>(null);
  const assignPicklist = useAssignPicklist();
  const assignPicklistEmployee = useAssignPicklistEmployee();
  const validationScan = useValidationScan();
  const finalizeValidation = useValidationFinalize();
  const detachPicklist = useDetachPicklist();
  const assignValidationValidator = useAssignValidationValidator();
  const detachValidation = useDetachValidation();
  const isValidationMode = mode === "validation";
  const isCollectMode = mode === "collect";

  const { data: employees = [] } = useEmployees({ PageSize: 500 });

  const filters: PicklistsFilters = useMemo(
    () => ({ Statuses: statuses, skip: pageIndex * PAGE_SIZE }),
    [statuses, pageIndex]
  );
  const { data: picklists = [], isLoading, error } = usePicklists(filters);
  const { data: picklistDetail, isLoading: detailLoading } = usePicklistByDocEntry(selectedDocEntry);
  const { data: validationItems = [] } = useValidationItems(
    isValidationMode ? selectedDocEntry : null
  );
  const { data: transferLines = [], isLoading: transferDetailLoading } =
    useRequiredTransfersByIds(selectedTransferReqId != null ? [selectedTransferReqId] : []);

  const currentLines: PicklistLine[] =
    (isValidationMode ? validationItems : picklistDetail?.lines) ?? [];

  const allLinesValidated =
    currentLines.length > 0 &&
    currentLines.every((line) => line.status === EPickListLineStatus.Validated);

  // Validation progress by unit quantity: how much is needed in total, how much
  // has been confirmed (whole validated lines), and how much is still left.
  const validationTotals = useMemo(() => {
    const lineQty = (line: PicklistLine) => line.totalQty ?? line.requestedQty ?? 0;
    const max = currentLines.reduce((sum, line) => sum + lineQty(line), 0);
    const confirmed = currentLines.reduce(
      (sum, line) =>
        line.status === EPickListLineStatus.Validated ? sum + lineQty(line) : sum,
      0
    );
    return { max, confirmed, left: max - confirmed };
  }, [currentLines]);

  // Aggregated validation items can arrive without a pack size, so fall back to
  // the quantityInPack of the picklist-detail line(s) with the same itemCode.
  const resolvePackSize = (line: PicklistLine): number => {
    if (line.quantityInPack && line.quantityInPack > 0) return line.quantityInPack;
    const match = picklistDetail?.lines.find(
      (l) => l.itemCode === line.itemCode && (l.quantityInPack ?? 0) > 0
    );
    return match?.quantityInPack ?? 0;
  };

  const hasNextPage = picklists.length >= PAGE_SIZE;
  const hasPrevPage = pageIndex > 0;
  const rangeStart = pageIndex * PAGE_SIZE + 1;
  const rangeEnd = pageIndex * PAGE_SIZE + picklists.length;

  // Extract the order id from a scanned QR ("pick-<id>") or a plain numeric id.
  // Returns null when the value is neither.
  const parseOrderId = (raw: string): number | null => {
    const value = raw.trim();
    const match = /^pick-(\d+)$/i.exec(value);
    if (match) return Number(match[1]);
    if (/^\d+$/.test(value)) return Number(value);
    return null;
  };

  // Global scanner: scanning "pick-<id>" while the list is shown opens that order.
  const handlePickScan = (raw: string) => {
    const id = parseOrderId(raw);
    if (id == null) return;
    // Open by id directly — the detail is fetched by id, so the order need not
    // be on the currently visible page.
    setSelectedDocEntry(id);
  };

  // Visible search box: search an order by its scanned QR code or plain id.
  const handleSearchSubmit = () => {
    const id = parseOrderId(searchInput);
    if (id == null) {
      message.warning(t("picklist.searchInvalidCode"));
      return;
    }
    setSelectedDocEntry(id);
    setSearchInput("");
  };
  // Global list scanner. When a serial scanner is connected, scans arrive here
  // via the device subscription with NO dependence on input focus, so the user
  // never has to click into the search box first. serialActive tells the UI a
  // scanner is live so we can hint that and keep the manual box out of the way.
  const { serialActive: listScannerActive } = useScannerInput({
    mode: "global",
    enabled: selectedDocEntry == null,
    onScan: handlePickScan,
  });

  // In-modal validation scan: match a line by barcode, then confirm.
  const handleScanCode = (value: string) => {
    if (!isValidationMode || !picklistDetail) return;
    // A line's barcode field may hold several barcodes joined by "|"
    // (e.g. "{Barcode1}|{Barcode2}"), or just one — match against any token.
    const line = currentLines.find((l) =>
      (l.barcode ?? "").split("|").some((b) => b.trim() === value)
    );
    if (!line) {
      message.warning(t("validation.barcodeNotFound"));
      return;
    }
    if (line.status === EPickListLineStatus.Validated) {
      message.warning(t("validation.alreadyValidated"));
      return;
    }
    if (validationScan.isLoading) return;
    if (!picklistDetail.assigneeName) {
      message.warning(t("validation.assignValidatorFirst"));
      return;
    }
    // Send the line's full barcode value to the API (may be "A|B|C"),
    // not just the single scanned token.
    setPendingScan({ line, barcode: (line.barcode ?? "").trim() });
  };
  const { inputRef: barcodeInputRef, onKeyDown: handleBarcodeKeyDown } = useScannerInput({
    mode: "input",
    enabled: isValidationMode && selectedDocEntry != null && !!picklistDetail,
    onScan: handleScanCode,
  });

  useEffect(() => {
    // The hidden scanner input only mounts once picklistDetail has loaded, so
    // wait for it before trying to focus — otherwise the ref is still null and
    // scans go nowhere.
    if (!(isValidationMode && selectedDocEntry != null && picklistDetail)) return;

    const focusHiddenInput = () => {
      barcodeInputRef.current?.focus();
    };

    focusHiddenInput();
    const t1 = setTimeout(focusHiddenInput, 150);
    const t2 = setTimeout(focusHiddenInput, 400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isValidationMode, selectedDocEntry, picklistDetail, barcodeInputRef]);

  // When a validation modal opens on a picklist whose lines are already all
  // confirmed, default the table to SHOW validated lines (otherwise it would
  // look empty). Runs once per open — after that the user's toggle wins.
  useEffect(() => {
    if (selectedDocEntry == null) {
      showValidatedInitDocEntry.current = null;
      return;
    }
    if (!isValidationMode) return;
    if (currentLines.length === 0) return; // wait for lines to load
    if (showValidatedInitDocEntry.current === selectedDocEntry) return;
    showValidatedInitDocEntry.current = selectedDocEntry;
    setShowValidated(allLinesValidated);
  }, [selectedDocEntry, isValidationMode, currentLines, allLinesValidated]);

  const handleViewDetail = (docEntry: number) => {
    setSelectedDocEntry(docEntry);
  };

  const handleCloseModal = () => {
    setSelectedDocEntry(null);
    setDeliveryPackageCount(0);
    setSelectedEmployeeId(null);
    setLabelCopies(1);
    setShowValidated(false);
    setPendingScan(null);
  };

  const handlePrintLabel = () => {
    const item = picklists.find((p) => p.id === selectedDocEntry) ?? picklistDetail;
    if (!item) return;
    printLabelPopup({
      ...DEFAULT_LABEL_DATA,
      labelSize: "40x60",
      title: item.cardName ?? "",
      mainCode: item.deliveryNumber ?? String(item.salesOrderDocNum ?? item.id),
      copies: labelCopies,
    });
  };

  const handleConfirmScan = () => {
    if (!pendingScan || !picklistDetail) return;
    if (validationScan.isLoading) return;
    validationScan.mutate(
      { docEntry: picklistDetail.id, barcode: pendingScan.barcode },
      {
        onSuccess: () => { message.success(t("common.success")); },
        onError: () => { message.error(t("error.somethingWentWrong")); },
      }
    );
    setPendingScan(null);
    // Re-focus scanner input so worker can scan the next item immediately
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };

  const handleCancelScan = () => {
    setPendingScan(null);
    // Re-focus scanner input so worker can scan the next item immediately
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };

  // Keep the latest confirm handler without re-binding the Enter listener.
  const confirmScanRef = useRef(handleConfirmScan);
  useEffect(() => {
    confirmScanRef.current = handleConfirmScan;
  });

  // Enter confirms the pending scan, same as clicking the validate button.
  // Bound on the capture phase so a bare Enter can be told apart from the Enter
  // a scanner appends to a barcode: at capture time the hidden input still holds
  // the scanned code, before the wedge handler reads and clears it.
  useEffect(() => {
    if (!isValidationMode || !pendingScan) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target instanceof HTMLInputElement && target.value) return;
      if (target?.closest(".ant-select")) return;
      e.preventDefault();
      confirmScanRef.current();
    };

    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [isValidationMode, pendingScan]);

  const isAssigning = isValidationMode
    ? assignValidationValidator.isLoading
    : assignPicklistEmployee.isLoading;

  const handleAssign = (employeeId: number) => {
    if (!picklistDetail) return;
    const callbacks = {
      onSuccess: () => {
        message.success(t("common.success"));
        setSelectedEmployeeId(null);
      },
      onError: () => {
        message.error(t("error.somethingWentWrong"));
      },
    };
    if (isValidationMode) {
      assignValidationValidator.mutate(
        { picklistId: picklistDetail.id, validatorId: employeeId },
        callbacks
      );
    } else {
      assignPicklistEmployee.mutate(
        { picklistId: picklistDetail.id, employeeId },
        callbacks
      );
    }
  };

  const handleModalContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, [contenteditable], .ant-select")) {
      return;
    }
    if (isValidationMode && selectedDocEntry != null) {
      barcodeInputRef.current?.focus();
    }
  };

  const columns: ColumnsType<PicklistItem> = [
    {
      title: t("picklist_id"),
      dataIndex: "id",
      key: "id",
      width: 100,
      render: (id: number, record: PicklistItem) => (
        <div className="space-y-0.5">
          <p className="font-medium leading-none">{id}</p>
          {record.deliveryNumber && (
            <p className="text-xs text-muted-foreground font-mono leading-none">
              #{record.deliveryNumber}
            </p>
          )}
        </div>
      ),
    },
    { title: t("picklist_sales_order_doc_num"), dataIndex: "salesOrderDocNum", key: "salesOrderDocNum", width: 140 },
    { title: t("picklist_card_name"), dataIndex: "cardName", key: "cardName", width: 200 },
    { title: t("picklist_warehouse_code"), dataIndex: "warehouseCode", key: "warehouseCode", width: 120 },
    {
      title: t("picklist_to_warehouse"),
      key: "toWarehouse",
      width: 160,
      render: (_: unknown, record: PicklistItem) =>
        record.toWarehouseName || record.toWarehouseCode ? (
          <div className="space-y-0.5">
            <p className="leading-none">{record.toWarehouseName ?? "—"}</p>
            {record.toWarehouseCode && (
              <p className="text-xs text-muted-foreground font-mono leading-none">
                #{record.toWarehouseCode}
              </p>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      title: t("picklist_status"),
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: number) => {
        const key = EPickListStatus[status];
        const colors = STATUS_BADGE_COLORS[status];
        const statusText = key ? t(`picklistStatus.${key.toLowerCase()}`) : status;

        if (!colors) {
          return statusText;
        }

        return (
          <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", colors.bg, colors.text, colors.border)}>
            {statusText}
          </span>
        );
      },
    },
    {
      title: t("requiredTransfers.type"),
      dataIndex: "type",
      key: "type",
      width: 160,
      render: (type: number) => {
        const colors = TYPE_BADGE_COLORS[type];
        if (!colors) {
          return t(WAREHOUSE_CHECKING_TYPE_KEYS[type] ?? "common.noData");
        }
        return (
          <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border", colors.bg, colors.text, colors.border)}>
            {t(WAREHOUSE_CHECKING_TYPE_KEYS[type] ?? "common.noData")}
          </span>
        );
      },
    },
    {
      title: t("picklist_assignee"),
      dataIndex: "assigneeName",
      key: "assigneeName",
      width: 180,
      render: (val: string | null) => val ?? "—",
    },
    {
      title: t("common_actions"),
      key: "actions",
      width: 100,
      fixed: "right",
      render: (_: unknown, record: PicklistItem) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => handleViewDetail(record.id)}
        >
          <Eye className="w-4 h-4" />
          {t("common_view")}
        </Button>
      ),
    },
  ];

  const baseLineColumns: ColumnsType<PicklistLine> = [
    { title: "#", key: "index", width: 60, align: "center", render: (_: unknown, __: PicklistLine, idx: number) => idx + 1 },
    {
      title: t("picklist_line_product_name"),
      dataIndex: "productName",
      key: "productName",
      width: 260,
      render: (_: string, record: PicklistLine) => (
        <div className="space-y-0.5">
          <p className="font-medium">{record.productName}</p>
          <p className="text-xs text-muted-foreground font-mono">{record.itemCode}</p>
        </div>
      ),
    },
    {
      title: t("picklist_line_bin_code"),
      dataIndex: "binCode",
      key: "binCode",
      width: 120,
      render: (val: string | null) =>
        val ? (
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{val}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      title: t("picklist_line_transfer_doc"),
      dataIndex: "transferRequirementId",
      key: "transferRequirementId",
      width: 130,
      render: (_: number | null, record: PicklistLine) => {
        const docNum =
          picklists.find((p) => p.id === selectedDocEntry)?.checkingRequestId ??
          picklistDetail?.checkingRequestId;
        if (record.transferRequirementId != null) {
          return (
            <button
              type="button"
              className="font-mono text-xs font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 cursor-pointer"
              onClick={() => setSelectedTransferReqId(record.transferRequirementId!)}
            >
              #{docNum}
            </button>
          );
        }
        return (
          <span className="font-mono text-xs text-foreground">
            #{docNum}
          </span>
        );
      },
    },
    {
      title: t("picklist_line_requested_qty"),
      dataIndex: "requestedQty",
      key: "requestedQty",
      width: 100,
      render: (val: number, record: PicklistLine) => {
        const qty = record.totalQty ?? val;
        if (record.isWholePack && record.quantityInPack) {
          const boxes = qty / record.quantityInPack;
          return `${qty} (📦 ${boxes})`;
        }
        return qty;
      },
    },
    {
      title: t("picklist_line_status"),
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: number) => {
        const key = EPickListLineStatus[status];
        return key ? t(`picklistLineStatus.${key.toLowerCase()}`) : String(status);
      },
    },
  ];

  const validationColumn: ColumnsType<PicklistLine> = [
    ...baseLineColumns.filter((col) => !("key" in col && (col.key === "binCode" || col.key === "transferRequirementId"))),
    {
      title: t("validation.validate"),
      key: "validate",
      width: 120,
      fixed: "right",
      render: (_: unknown, line: PicklistLine) => {
        const isValidated = line.status === EPickListLineStatus.Validated;
        if (isValidated) {
          return (
            <span className="text-xs font-medium text-status-success">
              {t("validation.validated")}
            </span>
          );
        }
        const noAssignee = !picklistDetail?.assigneeName;
        const noBarcode = !line.barcode;
        const disabled = validationScan.isLoading || noAssignee || noBarcode;
        return (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => {
              if (!picklistDetail) return;
              validationScan.mutate(
                {
                  docEntry: picklistDetail.id,
                  barcode: (line.barcode ?? "").trim(),
                },
                {
                  onSuccess: () => {
                    message.success(t("common.success"));
                  },
                  onError: () => {
                    message.error(t("error.somethingWentWrong"));
                  },
                }
              );
            }}
            disabled={disabled}
          >
            {validationScan.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              t("validation.validate")
            )}
          </Button>
        );
      },
    },
  ];

  const lineColumns = isValidationMode ? validationColumn : baseLineColumns;

  return (
    <div className={hideHeader ? "space-y-6" : "p-6 space-y-6"}>
      {!hideHeader && (
        <PageHeader
          title={t(titleKey)}
          breadcrumbs={[{ label: t(parentKey) }, { label: t(titleKey) }]}
        />
      )}

      <ModuleCard>
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearchSubmit();
                }
              }}
              placeholder={t("picklist.searchByScanPlaceholder")}
              className="pl-8 h-9"
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="gap-1"
            onClick={handleSearchSubmit}
            disabled={!searchInput.trim()}
          >
            <Search className="w-4 h-4" />
            {t("common.searchAction")}
          </Button>
          {listScannerActive && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-status-success">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {t("picklist.scannerActiveHint")}
            </span>
          )}
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">{t("common_loading")}</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12 text-destructive">
            {error instanceof Error ? error.message : String(error)}
          </div>
        ) : (
          <>
            <Table
              columns={columns}
              dataSource={picklists}
              rowKey="id"
              pagination={false}
              scroll={{ x: "max-content" }}
            />
            {(picklists.length > 0 || pageIndex > 0) && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3 mt-0">
                <div className="text-sm text-muted-foreground">
                  {t("picklist_showing_range", { start: rangeStart, end: rangeEnd })}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPageIndex((p) => p - 1)}
                    disabled={!hasPrevPage}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="px-3 text-sm font-medium">
                    {hasPrevPage && "< "}
                    {rangeStart} – {rangeEnd}
                    {hasNextPage && " >"}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPageIndex((p) => p + 1)}
                    disabled={!hasNextPage}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </ModuleCard>

      <Modal
        title={t("picklist_detail_title", { docEntry: selectedDocEntry ?? "" })}
        open={selectedDocEntry != null}
        onCancel={handleCloseModal}
        width={1200}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {isValidationMode && picklistDetail && (
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    {t("validation.totalQty")}:{" "}
                    <span className="font-semibold text-foreground">
                      {validationTotals.max}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    {t("validation.confirmedQty")}:{" "}
                    <span className="font-semibold text-status-success">
                      {validationTotals.confirmed}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    {t("validation.leftQty")}:{" "}
                    <span className="font-semibold text-foreground">
                      {validationTotals.left}
                    </span>
                  </span>
                </div>
              )}
              {isValidationMode && picklistDetail && allLinesValidated && (
                <>
                  <Label className="text-sm whitespace-nowrap mb-0">
                    {t("picklist.deliveryPackageCount")}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={deliveryPackageCount === 0 ? "" : deliveryPackageCount}
                    placeholder={t("picklist.deliveryPackageCountPlaceholder")}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDeliveryPackageCount(
                        v === "" ? 0 : Math.max(0, parseInt(v, 10) || 0)
                      );
                    }}
                    className="w-28 h-9"
                  />
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isValidationMode &&
                picklistDetail &&
                allLinesValidated && (
                  <AntButton
                    key="finalize"
                    type="primary"
                    loading={finalizeValidation.isLoading}
                    disabled={deliveryPackageCount <= 0}
                    onClick={() => {
                      if (!picklistDetail) return;
                      finalizeValidation.mutate(
                        {
                          picklistId: picklistDetail.id,
                          deliveryPackageCount,
                        },
                        {
                          onSuccess: () => {
                            message.success(t("common.success"));
                            const item = picklists.find((p) => p.id === selectedDocEntry) ?? picklistDetail;
                            printLabelPopup({
                              ...DEFAULT_LABEL_DATA,
                              labelSize: "40x60",
                              title: item.cardName ?? "",
                              mainCode: item.deliveryNumber ?? String(item.salesOrderDocNum ?? item.id),
                              copies: labelCopies,
                            });
                            handleCloseModal();
                          },
                          onError: () => {
                            message.error(t("error.somethingWentWrong"));
                          },
                        }
                      );
                    }}
                  >
                    {t("validation.finalize")}
                  </AntButton>
                )}
              <AntButton key="close" onClick={handleCloseModal}>
                {t("common_close")}
              </AntButton>
            </div>
          </div>
        }
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : picklistDetail ? (
          <div
            className="space-y-4"
            onClick={handleModalContentClick}
            role="presentation"
          >
            {isValidationMode && (
              <input
                ref={barcodeInputRef}
                type="text"
                autoComplete="off"
                aria-hidden
                className="absolute left-[-9999px] w-px h-px opacity-0 overflow-hidden"
                onKeyDown={handleBarcodeKeyDown}
              />
            )}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              {printMode ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Nusxalar soni</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={labelCopies}
                        onChange={(e) =>
                          setLabelCopies(Math.max(1, Math.min(100, Number(e.target.value) || 1)))
                        }
                        className="w-24 h-9"
                      />
                      <Button size="sm" className="gap-1" onClick={handlePrintLabel}>
                        <Printer className="w-4 h-4" />
                        Chop etish
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t("picklist_assignee")}</p>
                    {picklistDetail.assigneeName ? (
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{picklistDetail.assigneeName}</p>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            const detachMutation = isValidationMode ? detachValidation : detachPicklist;
                            detachMutation.mutate(picklistDetail.id, {
                              onSuccess: () => {
                                message.success(t("common.success"));
                              },
                              onError: () => {
                                message.error(t("error.somethingWentWrong"));
                              },
                            });
                          }}
                          disabled={
                            isValidationMode ? detachValidation.isLoading : detachPicklist.isLoading
                          }
                          className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-100"
                          title={t("picklist.detach")}
                        >
                          {(isValidationMode ? detachValidation.isLoading : detachPicklist.isLoading) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    ) : (isCollectMode || isValidationMode) && user && user.role !== "admin" ? (
                      <div className="mt-1">
                        <Button
                          size="sm"
                          onClick={() => handleAssign(Number(user.employeeId))}
                          disabled={isAssigning}
                        >
                          {isAssigning ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            t("picklist.assignToMe")
                          )}
                        </Button>
                      </div>
                    ) : isCollectMode || isValidationMode ? (
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Select
                          showSearch
                          placeholder={t("inventoryCountings.selectUser")}
                          value={selectedEmployeeId ?? undefined}
                          onChange={(val) => setSelectedEmployeeId(val ?? null)}
                          options={employees.map((emp) => ({
                            value: emp.employeeId ?? (emp as any).EmployeeID ?? 0,
                            label: [emp.firstName, emp.lastName].filter(Boolean).join(" ") || "—",
                          }))}
                          filterOption={(input, option) =>
                            (option?.label ?? "").toString().toLowerCase().includes(input.toLowerCase())
                          }
                          optionFilterProp="label"
                          className="w-[220px] [&_.ant-select-selector]:!h-9"
                          notFoundContent={t("common.noResults")}
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            if (selectedEmployeeId == null) {
                              message.warning(t("inventoryCountings.selectUserFirst"));
                              return;
                            }
                            handleAssign(selectedEmployeeId);
                          }}
                          disabled={selectedEmployeeId == null || isAssigning}
                        >
                          {isAssigning ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            t("inventoryCountings.assign")
                          )}
                        </Button>
                      </div>
                    ) : (
                      <p className="font-medium">—</p>
                    )}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("picklist_warehouse_code")}</p>
                <p className="font-medium">{picklistDetail.warehouseCode}</p>
              </div>
            </div>
            {isValidationMode && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                {pendingScan ? (
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-2xl font-bold leading-tight break-words">
                      {pendingScan.line.productName}
                    </p>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 text-muted-foreground"
                      onClick={handleCancelScan}
                      title={t("common.cancel")}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-lg font-medium text-muted-foreground">
                    {t("validation.scanPrompt")}
                  </p>
                )}

                {pendingScan &&
                  (() => {
                    const qty =
                      pendingScan.line.totalQty ?? pendingScan.line.requestedQty ?? 0;
                    const boxPer = resolvePackSize(pendingScan.line);
                    const looseQty = boxPer > 0 ? qty % boxPer : qty;
                    const boxCount = boxPer > 0 ? Math.floor(qty / boxPer) : 0;
                    return (
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground mb-0">
                            {t("validation.qty")}
                          </Label>
                          <Input
                            type="number"
                            value={qty}
                            disabled
                            className="w-28 h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground mb-0">
                            {t("validation.qtyLoose")}
                          </Label>
                          <Input
                            type="number"
                            value={looseQty}
                            disabled
                            className="w-28 h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground mb-0">
                            {t("validation.qtyBoxes")}
                          </Label>
                          <Input
                            type="number"
                            value={boxCount}
                            disabled
                            className="w-28 h-9"
                          />
                        </div>
                        <AntButton
                          type="primary"
                          loading={validationScan.isLoading}
                          onClick={handleConfirmScan}
                        >
                          {t("validation.validate")}
                        </AntButton>
                      </div>
                    );
                  })()}

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => setShowValidated((s) => !s)}
                >
                  {showValidated ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  {showValidated
                    ? t("validation.hideValidated")
                    : t("validation.showValidated")}
                </Button>
              </div>
            )}
            {(() => {
              const lines =
                isValidationMode && !showValidated
                  ? currentLines.filter(
                      (line) => line.status !== EPickListLineStatus.Validated
                    )
                  : currentLines;
              const sortedLines = [...lines].sort((a, b) => {
                const aValidated = a.status === EPickListLineStatus.Validated;
                const bValidated = b.status === EPickListLineStatus.Validated;
                if (aValidated === bValidated) return 0;
                return aValidated ? 1 : -1;
              });
              return (
                <Table
                  columns={lineColumns}
                  dataSource={sortedLines}
                  rowKey="id"
                  pagination={false}
                  scroll={{ x: "max-content" }}
                  size="small"
                />
              );
            })()}

          </div>
        ) : null}
      </Modal>

      {/* Transfer requirement detail popup — opens when user clicks a #id badge in the Ko'chirish hujjati column */}
      <Modal
        title={
          selectedTransferReqId != null
            ? `Ko'chirish hujjati — #${selectedTransferReqId}`
            : ""
        }
        open={selectedTransferReqId != null}
        onCancel={() => setSelectedTransferReqId(null)}
        footer={
          <AntButton onClick={() => setSelectedTransferReqId(null)}>
            {t("common_close")}
          </AntButton>
        }
        width={520}
      >
        {transferDetailLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : transferLines.length > 0 ? (
          <div className="space-y-3 py-2">
            {transferLines.map((line) => (
              <div key={line.id} className="border rounded-lg p-3 space-y-3">
                {/* Product */}
                <div className="space-y-0.5">
                  <p className="font-medium leading-snug text-sm">{line.productName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{line.itemCode}</p>
                </div>

                {/* Bin route */}
                <div className="flex items-center gap-2 p-2 bg-muted/40 rounded-md">
                  <div className="flex-1 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Qayerdan</p>
                    <span className="font-mono text-xs font-semibold bg-white border rounded px-2 py-0.5 inline-block">
                      {line.sourceBinLocation}
                    </span>
                  </div>
                  <div className="text-muted-foreground">→</div>
                  <div className="flex-1 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Qayerga</p>
                    <span className="font-mono text-xs font-semibold bg-white border rounded px-2 py-0.5 inline-block">
                      {line.targetBinLocation}
                    </span>
                  </div>
                </div>

                {/* Quantity breakdown */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 bg-muted/30 rounded-md text-center">
                    <p className="text-xs text-muted-foreground mb-0.5">Miqdor</p>
                    <p className="text-lg font-bold">{line.quantity}</p>
                    <p className="text-xs text-muted-foreground">dona</p>
                  </div>
                  <div className="p-2 bg-muted/30 rounded-md text-center">
                    <p className="text-xs text-muted-foreground mb-0.5">Qutida</p>
                    <p className="text-lg font-bold">{line.quantityPerBox}</p>
                    <p className="text-xs text-muted-foreground">dona/quti</p>
                  </div>
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded-md text-center">
                    <p className="text-xs text-blue-600 mb-0.5">Qutilari</p>
                    <p className="text-lg font-bold text-blue-700">
                      {line.quantityPerBox > 0
                        ? (line.quantity / line.quantityPerBox).toFixed(2).replace(/\.?0+$/, "")
                        : "—"}
                    </p>
                    <p className="text-xs text-blue-600">quti</p>
                  </div>
                </div>

                {/* Status + batch */}
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border",
                    line.isTransferred
                      ? "bg-green-100 text-green-800 border-green-300"
                      : "bg-amber-100 text-amber-800 border-amber-300"
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", line.isTransferred ? "bg-green-500" : "bg-amber-500")} />
                    {line.isTransferred ? "Ko'chirilgan" : "Ko'chirilmagan"}
                  </span>
                  {line.batchNumber && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {line.batchNumber}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8 text-sm">Ma'lumot topilmadi</p>
        )}
      </Modal>
    </div>
  );
}
