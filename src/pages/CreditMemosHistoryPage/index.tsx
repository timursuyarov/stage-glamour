import { useState, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleCard } from "@/components/ui/stat-card";
import { useTranslation } from "react-i18next";
import {
  useCreditMemos,
  type CreditMemosFilters,
  type CreditMemoItem,
  type CreditMemoLine,
} from "@/entities/CreditMemos/api";
import { EReturnReasonType } from "@/enums/returnReason";
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
} from "@/components/ui/dialog";
import { Eye, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { DatePicker, Tooltip } from "antd";
import { ClearOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const PAGE_SIZE = 20;

const REASON_LABEL_KEYS: Record<number, string> = {
  [EReturnReasonType.Valid]: "returns.reasonValid",
  [EReturnReasonType.Damaged]: "returns.reasonDamaged",
  [EReturnReasonType.Expired]: "returns.reasonExpired",
};

export default function CreditMemosHistoryPage() {
  const { t } = useTranslation();
  const [selectedDoc, setSelectedDoc] = useState<CreditMemoItem | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [filterDocNum, setFilterDocNum] = useState("");
  const [filterCardCode, setFilterCardCode] = useState("");
  const [filterCardName, setFilterCardName] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<CreditMemosFilters>({});

  // Debounced apply for text fields
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
      PageSize: PAGE_SIZE,
      Skip: pageIndex * PAGE_SIZE,
    }),
    [appliedFilters, pageIndex]
  );

  const { data: items = [], isLoading } = useCreditMemos(filters);
  const hasNextPage = items.length >= PAGE_SIZE;
  const hasPrevPage = pageIndex > 0;

  const handleClearFilters = () => {
    setFilterDocNum("");
    setFilterCardCode("");
    setFilterCardName("");
    setFilterStartDate("");
    setFilterEndDate("");
    setAppliedFilters({});
    setPageIndex(0);
  };

  const lines = selectedDoc?.stockTransferLines ?? [];

  const rangeStart = pageIndex * PAGE_SIZE + 1;
  const rangeEnd = pageIndex * PAGE_SIZE + items.length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("nav.returnHistory")}
        breadcrumbs={[
          { label: t("nav.operational") },
          { label: t("nav.return") },
          { label: t("nav.returnHistory") },
        ]}
      />

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

        {/* Main table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">{t("common_loading")}</span>
          </div>
        ) : (
          <>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold uppercase">{t("creditMemos.docNum")}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">{t("creditMemos.cardName")}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">{t("creditMemos.cardCode")}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">{t("common.date")}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase w-24">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                        {t("common.noData")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((doc) => (
                      <TableRow key={doc.docEntry} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-sm">{doc.docNum}</TableCell>
                        <TableCell className="min-w-[220px] break-words" title={doc.cardName}>
                          {doc.cardName}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{doc.cardCode}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{doc.docDate}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => setSelectedDoc(doc)}
                          >
                            <Eye className="w-4 h-4" />
                            {t("common.see")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
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
                  <span className="px-2 text-sm text-muted-foreground">
                    {pageIndex + 1}
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

      {/* Lines modal */}
      <Dialog open={selectedDoc != null} onOpenChange={(open) => !open && setSelectedDoc(null)}>
        <DialogContent className="max-w-[1200px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-3">
              {selectedDoc && (
                <>
                  <span className="font-mono text-muted-foreground">#{selectedDoc.docEntry}</span>
                  <span>{selectedDoc.cardName}</span>
                  <span className="text-muted-foreground font-normal text-sm">
                    ({selectedDoc.docNum}, {selectedDoc.docDate})
                  </span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedDoc && (
            <div className="border rounded-lg overflow-auto flex-1 min-h-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold uppercase w-12">#</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">{t("creditMemos.itemDescription")}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase w-20">{t("common.quantity")}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">{t("returns.condition")}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">{t("returns.batchNumber")}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">{t("admission.expiryDate")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        {t("common.noData")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((line: CreditMemoLine, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-sm">{idx + 1}</TableCell>
                        <TableCell className="min-w-[280px]" title={line.itemDescription}>
                          <p className="break-words">{line.itemDescription}</p>
                          {line.itemCode && (
                            <p className="font-mono text-xs text-muted-foreground mt-0.5">#{line.itemCode}</p>
                          )}
                          {line.smartupCode && (
                            <p className="font-mono text-xs text-muted-foreground mt-0.5">{line.smartupCode}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{line.quantity}</TableCell>
                        <TableCell>
                          {line.cancelItemType != null
                            ? t(REASON_LABEL_KEYS[line.cancelItemType] ?? "common.noData")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm">{line.batchNumber ?? "—"}</TableCell>
                        <TableCell className="text-sm">
                          {line.batchExpiryDate
                            ? new Date(line.batchExpiryDate).toLocaleDateString()
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
