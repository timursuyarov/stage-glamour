import { useState, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleCard } from "@/components/ui/stat-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import {
  useCreditMemosDrafts,
  useCreditMemoDraftDetail,
  useReturnMutation,
  type CreditMemosFilters,
  type CreditMemoItem,
  type ReturnLinePayload,
} from "@/entities/CreditMemos/api";
import {
  useInventoryTransferRequests,
  useRegionReturnMutation,
  type InventoryTransferRequestItem,
} from "@/entities/InventoryTransferRequests/api";
import { EReturnReasonType } from "@/enums/returnReason";
import { useSignalRWaiting } from "@/contexts/SignalRWaitingContext";
import { useSignalRHub } from "@/contexts/SignalRHubContext";
import { useRequiredTransfersNotification } from "@/contexts/RequiredTransfersNotificationContext";
import { useScannerInput } from "@/hooks/useScannerInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Eye, Loader2, ChevronLeft, ChevronRight, CheckCircle2, XCircle, AlertTriangle, X } from "lucide-react";
import { Table as AntTable, DatePicker, message, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ClearOutlined } from "@ant-design/icons";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { validateReturnLine, type EwsIssue } from "@/lib/ews";
import { EwsWarning } from "@/components/ui/ews-warning";
import { useQueryClient } from "react-query";
import dayjs from "dayjs";

const PAGE_SIZE = 20;

// Region-to-region returns: inventory transfer requests destined for this warehouse
const REGION_TO_WAREHOUSE = "Bufer";

// Persisted active tab on the returns drafts page
const ACTIVE_TAB_STORAGE_KEY = "returnsDraftsActiveTab";

// Region transfer requests return docDate as "DD.MM.YYYY", which `new Date()` can't parse.
const formatTransferDate = (val?: string | null): string => {
  if (!val) return "—";
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(val.trim());
  if (match) {
    const [, dd, mm, yyyy] = match;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd)).toLocaleDateString();
  }
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? val : parsed.toLocaleDateString();
};

const REASON_BUTTONS = [
  {
    reason: EReturnReasonType.Valid,
    labelKey: "returns.reasonValid",
    icon: CheckCircle2,
    activeClass: "bg-green-600 text-white border-green-600 hover:bg-green-700",
  },
  {
    reason: EReturnReasonType.Damaged,
    labelKey: "returns.reasonDamaged",
    icon: XCircle,
    activeClass: "bg-red-600 text-white border-red-600 hover:bg-red-700",
  },
  {
    reason: EReturnReasonType.Expired,
    labelKey: "returns.reasonExpired",
    icon: AlertTriangle,
    activeClass: "bg-amber-600 text-white border-amber-600 hover:bg-amber-700",
  },
];

export default function CreditMemosDraftsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { setRequiredTransfersNotification } = useRequiredTransfersNotification();

  const [activeTab, setActiveTab] = useState<string>(
    () => localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) || "salesOrder"
  );

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, value);
  };

  const [selectedDocEntry, setSelectedDocEntry] = useState<number | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [filterDocNum, setFilterDocNum] = useState("");
  const [filterCardCode, setFilterCardCode] = useState("");
  const [filterCardName, setFilterCardName] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<CreditMemosFilters>({});

  const [lineReasons, setLineReasons] = useState<Record<number, number>>({});
  const [lineReasonsByDoc, setLineReasonsByDoc] = useState<
    Record<number, Record<number, number>>
  >({});
  const [barcodeFilter, setBarcodeFilter] = useState("");
  // Serial scanner (with keyboard-wedge fallback when not connected).
  const { inputRef: barcodeInputRef, onKeyDown: handleBarcodeKeyDown } = useScannerInput({
    enabled: selectedDocEntry != null,
    onScan: (code) => setBarcodeFilter(code),
  });
  const [returnLoading, setReturnLoading] = useSignalRWaiting("returnDrafts");
  const { startListening } = useSignalRHub();

  const returnMutation = useReturnMutation();

  useEffect(() => {
    const timer = setTimeout(() => {
      setPageIndex(0);
      setAppliedFilters((prev) => ({
        ...prev,
        DocNum: filterDocNum.trim() ? Number(filterDocNum) : undefined,
        CardCode: filterCardCode.trim() || undefined,
        CardName: filterCardName.trim() || undefined,
      }));
    }, 750);
    return () => clearTimeout(timer);
  }, [filterDocNum, filterCardCode, filterCardName]);

  const filters: CreditMemosFilters = useMemo(
    () => ({
      ...appliedFilters,
      Status: 2,
      PageSize: PAGE_SIZE,
      Skip: pageIndex * PAGE_SIZE,
    }),
    [appliedFilters, pageIndex]
  );

  const { data: items = [], isLoading } = useCreditMemosDrafts(filters);
  const { data: detail, isLoading: detailLoading } = useCreditMemoDraftDetail(selectedDocEntry);
  const hasNextPage = items.length >= PAGE_SIZE;
  const hasPrevPage = pageIndex > 0;

  // Region-to-region tab: inventory transfer requests filtered by destination warehouse
  const [regionPageIndex, setRegionPageIndex] = useState(0);
  const { data: regionItems = [], isLoading: regionLoading } =
    useInventoryTransferRequests({
      ToWarehouseCode: REGION_TO_WAREHOUSE,
      PageSize: PAGE_SIZE,
      Skip: regionPageIndex * PAGE_SIZE,
    });
  const regionHasNextPage = regionItems.length >= PAGE_SIZE;
  const regionHasPrevPage = regionPageIndex > 0;
  const regionRangeStart = regionPageIndex * PAGE_SIZE + 1;
  const regionRangeEnd = regionPageIndex * PAGE_SIZE + regionItems.length;

  // Region-to-region return modal state
  const [selectedRegionRequest, setSelectedRegionRequest] =
    useState<InventoryTransferRequestItem | null>(null);
  const [regionLineReasons, setRegionLineReasons] = useState<
    Record<number, number>
  >({});
  const regionReturnMutation = useRegionReturnMutation();

  const regionLines = selectedRegionRequest?.stockTransferLines ?? [];
  const allRegionLinesHaveReason =
    regionLines.length > 0 &&
    regionLines.every((line) => regionLineReasons[line.lineNum] != null);

  const handleOpenRegionModal = (record: InventoryTransferRequestItem) => {
    setSelectedRegionRequest(record);
    setRegionLineReasons({});
  };

  const handleCloseRegionModal = () => {
    setSelectedRegionRequest(null);
    setRegionLineReasons({});
  };

  const setRegionReason = (lineNum: number, reason: number) => {
    setRegionLineReasons((prev) => ({ ...prev, [lineNum]: reason }));
  };

  const handleRegionReturn = async () => {
    if (!selectedRegionRequest || !allRegionLinesHaveReason) return;

    const docEntry = selectedRegionRequest.docEntry;
    const payload = regionLines.map((line) => ({
      lineNum: line.lineNum,
      reasonId: regionLineReasons[line.lineNum],
    }));

    setReturnLoading(true);
    try {
      await regionReturnMutation.mutateAsync({ docEntry, lines: payload });
    } catch {
      message.error(t("error.somethingWentWrong"));
      setReturnLoading(false);
      return;
    }

    handleCloseRegionModal();

    startListening("returnDrafts", {
      onCompleted: (result) => {
        if (!result?.isSuccess) {
          toast.error(result?.message ?? t("error.somethingWentWrong"));
          return;
        }
        setRequiredTransfersNotification(true);
        queryClient.invalidateQueries({
          queryKey: ["inventory-transfer-requests"],
        });
        toast.success(result.message);
      },
    });
  };

  const handleClearFilters = () => {
    setFilterDocNum("");
    setFilterCardCode("");
    setFilterCardName("");
    setFilterStartDate("");
    setFilterEndDate("");
    setAppliedFilters({});
    setPageIndex(0);
  };

  const handleOpenModal = (doc: CreditMemoItem) => {
    setSelectedDocEntry(doc.docEntry);
    const saved = lineReasonsByDoc[doc.docEntry];
    if (saved && Object.keys(saved).length > 0) {
      setLineReasons(saved);
    } else {
      setLineReasons({});
    }
  };

  // When detail is loaded, restore saved reasons if we have them
  useEffect(() => {
    const lines = detail?.documentLines ?? [];
    if (!selectedDocEntry || lines.length === 0) return;
    setLineReasons((prev) => {
      // If current state already has reasons, keep them
      if (Object.keys(prev).length > 0) return prev;

      // If we have saved reasons for this doc, restore them
      const saved = lineReasonsByDoc[selectedDocEntry];
      if (saved && Object.keys(saved).length > 0) {
        return saved;
      }

      // Otherwise, leave all lines without a selected reason
      return {};
    });
  }, [selectedDocEntry, detail?.documentLines, lineReasonsByDoc]);

  const handleCloseModal = () => {
    setSelectedDocEntry(null);
  };

  const setReason = (lineNum: number, reason: number) => {
    setLineReasons((prev) => ({ ...prev, [lineNum]: reason }));
    if (selectedDocEntry != null) {
      setLineReasonsByDoc((store) => ({
        ...store,
        [selectedDocEntry]: {
          ...(store[selectedDocEntry] ?? {}),
          [lineNum]: reason,
        },
      }));
    }
  };

  const detailLines = detail?.documentLines ?? [];
  const filteredDetailLines = barcodeFilter
    ? detailLines.filter((line) => {
        const code = (line.U_BarCode ?? line.barCode ?? "").trim();
        return code === barcodeFilter;
      })
    : detailLines;
  const allLinesHaveReason =
    detailLines.length > 0 &&
    detailLines.every((line) => lineReasons[line.lineNum] != null);

  // EWS: validate lines before return submission
  const ewsIssues = useMemo<EwsIssue[]>(() => {
    return detailLines.flatMap((line) => {
      const msgs = validateReturnLine(line);
      return msgs.length > 0
        ? [{ label: `Line ${line.lineNum + 1} / ${line.itemCode}`, messages: msgs }]
        : [];
    });
  }, [detailLines]);

  useEffect(() => {
    if (!(selectedDocEntry != null && detail && barcodeInputRef.current)) return;

    const focusHiddenInput = () => {
      barcodeInputRef.current?.focus();
    };

    const t1 = setTimeout(focusHiddenInput, 150);
    const t2 = setTimeout(focusHiddenInput, 400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [selectedDocEntry, detail, barcodeInputRef]);

  const handleClearBarcode = () => {
    setBarcodeFilter("");
    barcodeInputRef.current?.focus();
  };

  const handleModalContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, [contenteditable], .ant-picker")) return;
    if (selectedDocEntry != null && detail) {
      barcodeInputRef.current?.focus();
    }
  };

  const handleReturn = async () => {
    if (!selectedDocEntry || !allLinesHaveReason) return;

    const currentDocEntry = selectedDocEntry;
    const payload: ReturnLinePayload[] = detailLines.map((line) => ({
      lineNum: line.lineNum,
      reasonId: lineReasons[line.lineNum],
    }));

    setReturnLoading(true);
    try {
      await returnMutation.mutateAsync({ docEntry: selectedDocEntry, lines: payload });
    } catch {
      message.error(t("error.somethingWentWrong"));
      setReturnLoading(false);
      return;
    }

    // On successful submit, clear reasons for this document
    if (currentDocEntry != null) {
      setLineReasons({});
      setLineReasonsByDoc((store) => {
        const { [currentDocEntry]: _, ...rest } = store;
        return rest;
      });
    }

    handleCloseModal();

    startListening("returnDrafts", {
      onCompleted: (result) => {
        if (!result?.isSuccess) {
          toast.error(result?.message ?? t("error.somethingWentWrong"));
          return;
        }
        setRequiredTransfersNotification(true);
        queryClient.invalidateQueries({ queryKey: ["credit-memos"] });
        toast.success(result.message);
      },
    });
  };

  const columns: ColumnsType<CreditMemoItem> = [
    {
      title: "DocEntry",
      dataIndex: "docEntry",
      key: "docEntry",
      width: 100,
      render: (val: number) => <span className="font-mono text-sm">{val}</span>,
    },
    {
      title: t("creditMemos.docNum"),
      dataIndex: "docNum",
      key: "docNum",
      width: 120,
      render: (val: number) => <span className="font-mono text-sm">{val}</span>,
    },
    {
      title: t("common.date"),
      dataIndex: "docDate",
      key: "docDate",
      width: 130,
      render: (val: string) => new Date(val).toLocaleDateString(),
    },
    {
      title: t("creditMemos.cardCode"),
      dataIndex: "cardCode",
      key: "cardCode",
      width: 130,
      render: (val: string) => <span className="font-mono text-sm">{val}</span>,
    },
    {
      title: t("creditMemos.cardName"),
      dataIndex: "cardName",
      key: "cardName",
    },
    {
      title: t("creditMemos.documentStatus"),
      dataIndex: "documentStatus",
      key: "documentStatus",
      width: 140,
    },
    {
      title: t("common.actions"),
      key: "actions",
      width: 100,
      align: "center" as const,
      render: (_: unknown, record: CreditMemoItem) => (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => handleOpenModal(record)}
        >
          <Eye className="w-4 h-4" />
          {t("common.see")}
        </Button>
      ),
    },
  ];

  const regionColumns: ColumnsType<InventoryTransferRequestItem> = [
    {
      title: "DocEntry",
      dataIndex: "docEntry",
      key: "docEntry",
      width: 100,
      render: (val: number) => <span className="font-mono text-sm">{val}</span>,
    },
    {
      title: t("creditMemos.docNum"),
      dataIndex: "docNum",
      key: "docNum",
      width: 120,
      render: (val: number) => <span className="font-mono text-sm">{val}</span>,
    },
    {
      title: t("common.date"),
      dataIndex: "docDate",
      key: "docDate",
      width: 130,
      render: (val: string) => formatTransferDate(val),
    },
    {
      title: t("moveToRegion.fromWarehouse"),
      dataIndex: "fromWarehouse",
      key: "fromWarehouse",
      width: 160,
      render: (val: string, record) => (
        <div>
          <span className="font-mono text-sm">{val}</span>
          {record.fromWarehouseName && (
            <div className="text-xs text-muted-foreground">
              {record.fromWarehouseName}
            </div>
          )}
        </div>
      ),
    },
    {
      title: t("moveToRegion.toWarehouse"),
      dataIndex: "toWarehouse",
      key: "toWarehouse",
      width: 160,
      render: (val: string, record) => (
        <div>
          <span className="font-mono text-sm">{val}</span>
          {record.toWarehouseName && (
            <div className="text-xs text-muted-foreground">
              {record.toWarehouseName}
            </div>
          )}
        </div>
      ),
    },
    {
      title: t("common.actions"),
      key: "actions",
      width: 100,
      align: "center" as const,
      render: (_: unknown, record: InventoryTransferRequestItem) => (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => handleOpenRegionModal(record)}
        >
          <Eye className="w-4 h-4" />
          {t("common.see")}
        </Button>
      ),
    },
  ];

  const rangeStart = pageIndex * PAGE_SIZE + 1;
  const rangeEnd = pageIndex * PAGE_SIZE + items.length;

  return (
    <div className="relative min-h-full p-6 space-y-6">
      {returnLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-8 py-6 shadow-lg">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm font-medium">{t("common_loading")}</p>
            <p className="text-xs text-muted-foreground">{t("signalR.waiting")}</p>
          </div>
        </div>
      )}
      <PageHeader
        title={t("nav.returnDrafts")}
        breadcrumbs={[
          { label: t("nav.operational") },
          { label: t("nav.return") },
          { label: t("nav.returnDrafts") },
        ]}
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="salesOrder">
            {t("returns.tabSalesOrder")}
          </TabsTrigger>
          <TabsTrigger value="regionToRegion">
            {t("returns.tabRegionToRegion")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="salesOrder">
          <ModuleCard>
        {/* Filters */}
        <div className="mb-8 flex items-end justify-between gap-4">
          <div className="flex items-end gap-3 overflow-x-auto pb-2">
            <div className="space-y-2 flex-shrink-0">
              <Label className="text-xs">{t("creditMemos.docNum")}</Label>
              <Input
                placeholder="—"
                value={filterDocNum}
                onChange={(e) => setFilterDocNum(e.target.value)}
                className="h-9 w-32"
              />
            </div>
            <div className="space-y-2 flex-shrink-0">
              <Label className="text-xs">{t("creditMemos.cardCode")}</Label>
              <Input
                placeholder={t("common.search")}
                value={filterCardCode}
                onChange={(e) => setFilterCardCode(e.target.value)}
                className="h-9 w-40"
              />
            </div>
            <div className="space-y-2 flex-shrink-0">
              <Label className="text-xs">{t("creditMemos.cardName")}</Label>
              <Input
                placeholder={t("common.search")}
                value={filterCardName}
                onChange={(e) => setFilterCardName(e.target.value)}
                className="h-9 w-52"
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              <Label className="text-xs">{t("creditMemos.startDate")}</Label>
              <DatePicker
                value={filterStartDate ? dayjs(filterStartDate) : null}
                onChange={(date) => {
                  setPageIndex(0);
                  setFilterStartDate(date ? date.format("YYYY-MM-DD") : "");
                  setAppliedFilters((prev) => ({
                    ...prev,
                    StartDate: date ? date.format("YYYY-MM-DD") : undefined,
                  }));
                }}
                placeholder={t("sales_orders_select_date")}
                className="h-9 w-40"
                format="YYYY-MM-DD"
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              <Label className="text-xs">{t("creditMemos.endDate")}</Label>
              <DatePicker
                value={filterEndDate ? dayjs(filterEndDate) : null}
                onChange={(date) => {
                  setPageIndex(0);
                  setFilterEndDate(date ? date.format("YYYY-MM-DD") : "");
                  setAppliedFilters((prev) => ({
                    ...prev,
                    EndDate: date ? date.format("YYYY-MM-DD") : undefined,
                  }));
                }}
                placeholder={t("sales_orders_select_date")}
                className="h-9 w-40"
                format="YYYY-MM-DD"
              />
            </div>
          </div>
          <Tooltip title={t("common.clearFilters")}>
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground flex-shrink-0"
              aria-label={t("common.clearFilters")}
            >
              <ClearOutlined className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">{t("common_loading")}</span>
          </div>
        ) : (
          <>
            <AntTable
              columns={columns}
              dataSource={items}
              rowKey="docEntry"
              pagination={false}
              scroll={{ x: "max-content" }}
            />

            {(items.length > 0 || pageIndex > 0) && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3 mt-0">
                <div className="text-sm text-muted-foreground">
                  {rangeStart}–{rangeEnd}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => setPageIndex((p) => Math.max(p - 1, 0))}
                    disabled={!hasPrevPage || isLoading}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="px-3 text-sm font-medium">
                    {rangeStart} – {rangeEnd}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => setPageIndex((p) => p + 1)}
                    disabled={!hasNextPage || isLoading}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
          </ModuleCard>
        </TabsContent>

        <TabsContent value="regionToRegion">
          <ModuleCard>
            {regionLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">
                  {t("common_loading")}
                </span>
              </div>
            ) : (
              <>
                <AntTable
                  columns={regionColumns}
                  dataSource={regionItems}
                  rowKey="docEntry"
                  pagination={false}
                  scroll={{ x: "max-content" }}
                />

                {(regionItems.length > 0 || regionPageIndex > 0) && (
                  <div className="flex items-center justify-between border-t border-border px-4 py-3 mt-0">
                    <div className="text-sm text-muted-foreground">
                      {regionRangeStart}–{regionRangeEnd}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() =>
                          setRegionPageIndex((p) => Math.max(p - 1, 0))
                        }
                        disabled={!regionHasPrevPage || regionLoading}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="px-3 text-sm font-medium">
                        {regionRangeStart} – {regionRangeEnd}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => setRegionPageIndex((p) => p + 1)}
                        disabled={!regionHasNextPage || regionLoading}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </ModuleCard>
        </TabsContent>
      </Tabs>

      {/* Detail + Return modal */}
      <Dialog open={selectedDocEntry != null} onOpenChange={() => {}}>
        <DialogContent className="max-w-[1200px] max-h-[90vh] flex flex-col [&>button:last-of-type]:hidden">
          <DialogHeader className="relative pr-10">
            <DialogTitle className="flex flex-wrap items-center gap-3">
              {detail && (
                <>
                  <span className="font-mono text-muted-foreground">#{detail.docEntry}</span>
                  <span>{detail.cardName}</span>
                  <span className="text-muted-foreground font-normal text-sm">
                    ({detail.docNum}, {new Date(detail.docDate).toLocaleDateString()})
                  </span>
                </>
              )}
            </DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8"
              onClick={handleCloseModal}
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <div
              className="flex flex-col gap-3 flex-1 min-h-0"
              onClick={handleModalContentClick}
              role="presentation"
            >
              <input
                ref={barcodeInputRef}
                type="text"
                autoComplete="off"
                aria-hidden
                className="absolute left-[-9999px] w-px h-px opacity-0 overflow-hidden"
                onKeyDown={handleBarcodeKeyDown}
              />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {barcodeFilter
                    ? t("returns.selectedBarcode", { barcode: barcodeFilter })
                    : t("returns.noBarcodeSelected")}
                </span>
                {barcodeFilter && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 whitespace-nowrap"
                    onClick={handleClearBarcode}
                  >
                    {t("common.clearFilters")}
                  </Button>
                )}
              </div>
              <div className="border rounded-lg overflow-auto flex-1 min-h-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-semibold uppercase w-12">#</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">{t("creditMemos.itemDescription")}</TableHead>
                      <TableHead className="text-xs font-semibold uppercase w-16">{t("common.quantity")}</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">{t("returns.batchNumber")}</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">{t("admission.expiryDate")}</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">{t("returns.condition")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDetailLines.map((line, idx) => {
                      const batch = line.batchNumbers?.[0];
                      const selectedReason = lineReasons[line.lineNum];

                      const baseRowClasses =
                        "transition-colors bg-background hover:bg-background";

                      const rowHighlight =
                        selectedReason === EReturnReasonType.Valid
                          ? "bg-emerald-50 hover:bg-emerald-50"
                          : selectedReason === EReturnReasonType.Damaged
                          ? "bg-red-50 hover:bg-red-50"
                          : selectedReason === EReturnReasonType.Expired
                          ? "bg-amber-50 hover:bg-amber-50"
                          : "";

                      return (
                        <TableRow
                          key={line.lineNum}
                          className={cn(baseRowClasses, rowHighlight)}
                        >
                          <TableCell className="font-mono text-sm">{idx + 1}</TableCell>
                          <TableCell className="min-w-[280px]">
                            <div className="font-medium break-words" title={line.itemDescription}>
                              {line.itemDescription}
                            </div>
                            <div className="text-xs text-muted-foreground">{line.itemCode}</div>
                          </TableCell>
                          <TableCell className="font-semibold text-center">{line.quantity}</TableCell>
                          <TableCell className="text-sm">
                            {batch?.batchNumber ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {batch?.expiryDate
                              ? new Date(batch.expiryDate).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {REASON_BUTTONS.map(({ reason, labelKey, icon: Icon, activeClass }) => {
                                const isActive = selectedReason === reason;
                                return (
                                  <button
                                    key={reason}
                                    type="button"
                                    onClick={() => setReason(line.lineNum, reason)}
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                                      isActive
                                        ? activeClass
                                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                                    )}
                                  >
                                    <Icon className="w-3.5 h-3.5" />
                                    {t(labelKey)}
                                  </button>
                                );
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          <EwsWarning issues={ewsIssues} className="mx-0" />

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              {t("common.close")}
            </Button>
            <Button
              onClick={handleReturn}
              disabled={!allLinesHaveReason || returnLoading}
            >
              {returnLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {t("returns.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Region-to-region return modal */}
      <Dialog open={selectedRegionRequest != null} onOpenChange={() => {}}>
        <DialogContent className="max-w-[1200px] max-h-[90vh] flex flex-col [&>button:last-of-type]:hidden">
          <DialogHeader className="relative pr-10">
            <DialogTitle className="flex flex-wrap items-center gap-3">
              {selectedRegionRequest && (
                <>
                  <span className="font-mono text-muted-foreground">
                    #{selectedRegionRequest.docEntry}
                  </span>
                  <span>
                    {selectedRegionRequest.toWarehouseName ||
                      selectedRegionRequest.toWarehouse}
                  </span>
                  <span className="text-muted-foreground font-normal text-sm">
                    ({selectedRegionRequest.docNum},{" "}
                    {formatTransferDate(selectedRegionRequest.docDate)})
                  </span>
                </>
              )}
            </DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8"
              onClick={handleCloseRegionModal}
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogHeader>

          {selectedRegionRequest ? (
            <div className="flex flex-col gap-3 flex-1 min-h-0">
              <div className="border rounded-lg overflow-auto flex-1 min-h-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-semibold uppercase w-12">#</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">{t("creditMemos.itemDescription")}</TableHead>
                      <TableHead className="text-xs font-semibold uppercase w-16">{t("common.quantity")}</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">{t("returns.batchNumber")}</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">{t("admission.expiryDate")}</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">{t("returns.condition")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {regionLines.map((line, idx) => {
                      const selectedReason = regionLineReasons[line.lineNum];

                      const rowHighlight =
                        selectedReason === EReturnReasonType.Valid
                          ? "bg-emerald-50 hover:bg-emerald-50"
                          : selectedReason === EReturnReasonType.Damaged
                          ? "bg-red-50 hover:bg-red-50"
                          : selectedReason === EReturnReasonType.Expired
                          ? "bg-amber-50 hover:bg-amber-50"
                          : "";

                      return (
                        <TableRow
                          key={line.lineNum}
                          className={cn(
                            "transition-colors bg-background hover:bg-background",
                            rowHighlight
                          )}
                        >
                          <TableCell className="font-mono text-sm">{idx + 1}</TableCell>
                          <TableCell className="min-w-[280px]">
                            <div className="font-medium break-words" title={line.itemDescription}>
                              {line.itemDescription}
                            </div>
                            <div className="text-xs text-muted-foreground">{line.itemCode}</div>
                          </TableCell>
                          <TableCell className="font-semibold text-center">{line.quantity}</TableCell>
                          <TableCell className="text-sm">
                            {line.batchNumber ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {line.batchExpiryDate
                              ? new Date(line.batchExpiryDate).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {REASON_BUTTONS.map(({ reason, labelKey, icon: Icon, activeClass }) => {
                                const isActive = selectedReason === reason;
                                return (
                                  <button
                                    key={reason}
                                    type="button"
                                    onClick={() => setRegionReason(line.lineNum, reason)}
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                                      isActive
                                        ? activeClass
                                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                                    )}
                                  >
                                    <Icon className="w-3.5 h-3.5" />
                                    {t(labelKey)}
                                  </button>
                                );
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseRegionModal}>
              {t("common.close")}
            </Button>
            <Button
              onClick={handleRegionReturn}
              disabled={!allRegionLinesHaveReason || returnLoading}
            >
              {returnLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {t("returns.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
