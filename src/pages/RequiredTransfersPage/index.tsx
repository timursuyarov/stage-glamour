import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslation } from "react-i18next";
import {
  useRequiredTransfers,
  useRequiredTransferById,
  useTransferMutation,
  useAssignMutation,
  useFinalizeMutation,
  useDetachMutation,
  type RequiredTransferItem,
  type RequiredTransferLine,
  type RequiredTransfersFilters,
} from "@/entities/RequiredTransfers/api";
import { LOCAL_DATA_ENTITY_VALUES } from "@/entities/LocalData/api";
import { LocalDataDeleteButton } from "@/components/ui/local-data-delete-button";
import { EWarehouseCheckingType } from "@/enums/warehouseChecking";
import { useEmployees } from "@/entities/Employees/api";
import { useScannerInput } from "@/hooks/useScannerInput";
import { Button } from "@/components/ui/button";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Eye, Loader2, Check, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { message } from "antd";
import { useRequiredTransfersNotification } from "@/contexts/RequiredTransfersNotificationContext";

const PAGE_SIZE = 20;

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

function getEmployeeId(emp: { employeeId?: number; EmployeeID?: number }): number {
  return emp.employeeId ?? emp.EmployeeID ?? 0;
}

function getEmployeeName(emp: { firstName?: string; lastName?: string }): string {
  return [emp.firstName, emp.lastName].filter(Boolean).join(" ") || "—";
}

function getPercentageColor(percentage: number): string {
  if (percentage === 100) {
    return "text-green-600 font-semibold";
  } else if (percentage === 0) {
    return "text-amber-600";
  } else {
    return "text-amber-600 font-medium";
  }
}

export default function RequiredTransfersPage() {
  const { t } = useTranslation();
  const [pageIndex, setPageIndex] = useState(0);
  const [modalRequestId, setModalRequestId] = useState<number | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [assignPopoverOpen, setAssignPopoverOpen] = useState(false);
  const [computedPercentages, setComputedPercentages] = useState<Record<number, number>>({});
  // Serial scanner (with keyboard-wedge fallback when not connected).
  const { inputRef: barcodeInputRef, onKeyDown: handleBarcodeKeyDown } = useScannerInput({
    enabled: modalRequestId != null,
    onScan: (code) => handleScanCode(code),
  });

  const filters: RequiredTransfersFilters = useMemo(
    () => ({ skip: pageIndex * PAGE_SIZE }),
    [pageIndex]
  );
  const { data: items = [], isLoading } = useRequiredTransfers(filters);

  const hasNextPage = items.length >= PAGE_SIZE;
  const hasPrevPage = pageIndex > 0;
  const rangeStart = pageIndex * PAGE_SIZE + 1;
  const rangeEnd = pageIndex * PAGE_SIZE + items.length;
  const { data: lines = [], isLoading: linesLoading } = useRequiredTransferById(modalRequestId);
  const { data: employees = [] } = useEmployees({ PageSize: 500 });
  const transferMutation = useTransferMutation();
  const assignMutation = useAssignMutation();
  const finalizeMutation = useFinalizeMutation();
  const detachMutation = useDetachMutation();
  const { clearRequiredTransfersNotification } = useRequiredTransfersNotification();

  useEffect(() => {
    clearRequiredTransfersNotification();
  }, [clearRequiredTransfersNotification]);

  useEffect(() => {
    if (modalRequestId != null) {
      const timer = setTimeout(() => barcodeInputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [modalRequestId, barcodeInputRef]);

  const selectedRequest = items.find((r) => r.id === modalRequestId);

  // Computed percentage: (transferred count / total lines) * 100
  const completedPercentage =
    lines.length > 0
      ? Math.round((lines.filter((l) => l.isTransferred).length / lines.length) * 100)
      : 0;

  // Store computed % for the open request so table can show it
  useEffect(() => {
    if (modalRequestId != null && lines.length > 0) {
      setComputedPercentages((prev) => ({
        ...prev,
        [modalRequestId]: completedPercentage,
      }));
    }
  }, [modalRequestId, lines.length, completedPercentage]);

  const handleOpenModal = (request: RequiredTransferItem) => {
    setModalRequestId(request.id);
    setSelectedEmployeeId(null);
    setAssignPopoverOpen(false);
  };

  const handleCloseModal = () => {
    setModalRequestId(null);
    setSelectedEmployeeId(null);
  };

  const handleTransfer = (line: RequiredTransferLine) => {
    if (!modalRequestId || line.isTransferred) return;
    transferMutation.mutate(
      { requestId: modalRequestId, lineId: line.id },
      {
        onSuccess: () => {
          message.success(t("common.success"));
        },
        onError: () => {
          message.error(t("error.somethingWentWrong"));
        },
      }
    );
  };

  const handleFinalize = () => {
    if (!modalRequestId) return;
    finalizeMutation.mutate(
      { requestId: modalRequestId },
      {
        onSuccess: () => {
          message.success(t("common.success"));
          handleCloseModal();
        },
        onError: () => {
          message.error(t("error.somethingWentWrong"));
        },
      }
    );
  };

  const handleAssign = () => {
    if (!modalRequestId || selectedEmployeeId == null) {
      message.warning(t("common.select"));
      return;
    }
    assignMutation.mutate(
      { requestId: modalRequestId, userId: selectedEmployeeId },
      {
        onSuccess: () => {
          message.success(t("common.success"));
          setAssignPopoverOpen(false);
          setSelectedEmployeeId(null);
        },
        onError: () => {
          message.error(t("error.somethingWentWrong"));
        },
      }
    );
  };

  const handleScanCode = (value: string) => {
    const line = lines.find((l) => (l.barcode ?? "").trim() === value);
    if (!line) {
      message.warning(t("requiredTransfers.barcodeNotFound"));
      return;
    }
    if (line.isTransferred) {
      message.warning(t("requiredTransfers.alreadyTransferred"));
      return;
    }
    if (!selectedRequest?.assignedUser || transferMutation.isLoading || finalizeMutation.isLoading) {
      return;
    }
    handleTransfer(line);
  };

  const handleModalContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, [contenteditable]")) return;
    barcodeInputRef.current?.focus();
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("nav.requiredStockTransfer")}
        breadcrumbs={[
          { label: t("nav.operational") },
          { label: t("nav.requiredStockTransfer") },
        ]}
      />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-semibold uppercase w-16">#</TableHead>
              <TableHead className="text-xs font-semibold uppercase">{t("common.name")}</TableHead>
              <TableHead className="text-xs font-semibold uppercase">{t("requiredTransfers.type")}</TableHead>
              <TableHead className="text-xs font-semibold uppercase">{t("requiredTransfers.assignedUser")}</TableHead>
              <TableHead className="text-xs font-semibold uppercase w-28">{t("requiredTransfers.completedPercentage")}</TableHead>
              <TableHead className="text-xs font-semibold uppercase">{t("common.createdAt")}</TableHead>
              <TableHead className="text-xs font-semibold uppercase w-36">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  {t("common.noData")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((request, idx) => (
                <TableRow key={request.id} className="hover:bg-muted/50">
                  <TableCell className="font-mono text-sm">
                    {pageIndex * PAGE_SIZE + idx + 1}
                  </TableCell>
                  <TableCell>{request.name}</TableCell>
                  <TableCell>
                    {(() => {
                      const colors = TYPE_BADGE_COLORS[request.type];
                      return (
                        <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border", colors.bg, colors.text, colors.border)}>
                          {t(WAREHOUSE_CHECKING_TYPE_KEYS[request.type] ?? "common.noData")}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell>{request.assignedUser ?? "—"}</TableCell>
                  <TableCell className={getPercentageColor(request.completedPercentage)}>
                    {request.completedPercentage}%
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(request.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 h-8"
                        onClick={() => handleOpenModal(request)}
                      >
                        <Eye className="w-4 h-4" />
                        {t("common.see")}
                      </Button>
                      <LocalDataDeleteButton
                        entity={LOCAL_DATA_ENTITY_VALUES.OrdersCheckingRequests}
                        id={request.id}
                        rowLabel={request.name}
                        size="icon"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {(items.length > 0 || pageIndex > 0) && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <div className="text-sm text-muted-foreground">
              {rangeStart}–{rangeEnd}
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
                {rangeStart} – {rangeEnd}
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
      </div>

      {/* Detail modal */}
      <Dialog open={modalRequestId != null} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="max-w-[1200px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-muted-foreground">#{selectedRequest?.id}</span>
              <span>{selectedRequest?.name}</span>
              {lines.length > 0 && (
                <span className="text-muted-foreground font-normal text-sm">
                  ({lines.filter((l) => l.isTransferred).length}/{lines.length} — {completedPercentage}%)
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="flex flex-col flex-1 min-h-0 space-y-4 overflow-hidden" onClick={handleModalContentClick} role="presentation">
              <input
                ref={barcodeInputRef}
                type="text"
                autoComplete="off"
                aria-hidden
                className="absolute left-[-9999px] w-px h-px opacity-0 overflow-hidden"
                onKeyDown={handleBarcodeKeyDown}
              />
              {/* Assign section */}
              <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-muted/30 shrink-0">
                <span className="text-sm font-medium">{t("requiredTransfers.assignedUser")}:</span>
                {selectedRequest.assignedUser ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{selectedRequest.assignedUser}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        detachMutation.mutate(
                          { requestId: selectedRequest.id },
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
                      disabled={detachMutation.isLoading}
                      className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-100"
                      title={t("requiredTransfers.detach")}
                    >
                      {detachMutation.isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <>
                    <Popover open={assignPopoverOpen} onOpenChange={setAssignPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-[280px] justify-between font-normal"
                        >
                          <span className="truncate">
                            {selectedEmployeeId != null
                              ? getEmployeeName(employees.find((e) => getEmployeeId(e) === selectedEmployeeId) ?? {})
                              : t("common.select")}
                          </span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder={t("common.search")} className="h-9" />
                          <CommandList className="max-h-[240px]">
                            <CommandEmpty>{t("common.noResults")}</CommandEmpty>
                            <CommandGroup>
                              {employees.map((emp) => {
                                const id = getEmployeeId(emp);
                                return (
                                  <CommandItem
                                    key={id}
                                    value={getEmployeeName(emp)}
                                    onSelect={() => {
                                      setSelectedEmployeeId(id);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4 shrink-0",
                                        selectedEmployeeId === id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {getEmployeeName(emp)}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Button
                      size="sm"
                      onClick={handleAssign}
                      disabled={selectedEmployeeId == null || assignMutation.isLoading}
                    >
                      {assignMutation.isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        t("requiredTransfers.assign")
                      )}
                    </Button>
                  </>
                )}
              </div>

              {/* Lines table */}
              <div className="border rounded-lg overflow-auto flex-1 min-h-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-semibold uppercase">{t("requiredTransfers.productName")}</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">{t("common.quantity")}</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">{t("requiredTransfers.sourceBin")}</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">{t("requiredTransfers.targetBin")}</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">{t("requiredTransfers.batchNumber")}</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">{t("admission.expiryDate")}</TableHead>
                      <TableHead className="text-xs font-semibold uppercase w-28"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linesLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : lines.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          {t("common.noData")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell className="max-w-[260px]">
                            <div>
                              <p className="text-sm text-foreground">{line.productName}</p>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">{line.itemCode}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {line.quantityPerBox && line.quantity % line.quantityPerBox === 0
                              ? `${line.quantity} (📦 ${line.quantity / line.quantityPerBox})`
                              : line.quantity}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{line.sourceBinLocation}</TableCell>
                          <TableCell className="font-mono text-sm">{line.targetBinLocation}</TableCell>
                          <TableCell>{line.batchNumber ?? "—"}</TableCell>
                          <TableCell className="text-sm">
                            {line.expirationDate
                              ? new Date(line.expirationDate).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => handleTransfer(line)}
                              disabled={
                                !selectedRequest?.assignedUser ||
                                line.isTransferred ||
                                transferMutation.isLoading ||
                                finalizeMutation.isLoading
                              }
                            >
                              {line.isTransferred
                                ? t("requiredTransfers.transferred")
                                : t("requiredTransfers.transfer")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-2 pt-4 shrink-0">
                <Button variant="outline" size="sm" onClick={handleCloseModal}>
                  {t("common.close")}
                </Button>
                {!selectedRequest.isCompleted && (
                  <Button
                    size="sm"
                    onClick={handleFinalize}
                    disabled={
                      !selectedRequest.assignedUser ||
                      lines.length === 0 ||
                      lines.some((l) => !l.isTransferred) ||
                      finalizeMutation.isLoading
                    }
                  >
                    {finalizeMutation.isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      t("requiredTransfers.finalize")
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
