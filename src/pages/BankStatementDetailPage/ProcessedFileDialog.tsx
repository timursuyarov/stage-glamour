import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Table as AntTable,
  Select,
  AutoComplete,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/sonner";
import { numberWithSpacesIntl } from "@/lib/numberFormat";
import { useDebouncedCallback } from "@/lib/debounce";
import {
  useProcessedRows,
  useBusinessPartnerSearch,
  useSaveProcessed,
  useUploadToSap,
  type ProcessedRow,
  type UploadedDraft,
  type SaveProcessedRow,
  type SapUploadRow,
} from "@/entities/BankStatements/api";

interface Props {
  open: boolean;
  row: UploadedDraft | null;
  code: string;
  acctName: string;
  onOpenChange: (open: boolean) => void;
}

const truncate = (text?: string) =>
  text && text.length > 30 ? `${text.slice(0, 30)}...` : text ?? "";

/** BP/Account field-swap rule shared by both the PATCH and POST payloads. */
const bpAcctFields = (item: ProcessedRow) => ({
  u_BPCode: item.u_DocType === "A" ? null : item.u_BPCode,
  u_BPName: item.u_DocType === "A" ? null : item.u_BPName,
  u_AcctCode: item.u_DocType === "A" ? item.u_AcctCode : null,
  u_AcctName: item.u_DocType === "A" ? item.u_AcctName : null,
});

export function ProcessedFileDialog({
  open,
  row,
  code,
  acctName,
  onOpenChange,
}: Props) {
  const { t } = useTranslation();

  const paymentFor = [
    { value: "A", label: t("account") },
    { value: "C", label: t("customer") },
    { value: "S", label: t("supplier") },
  ];

  const { data: fetched, isLoading } = useProcessedRows(
    row?.u_ProcessedDataID,
    open,
  );

  const [tableData, setTableData] = useState<ProcessedRow[]>([]);
  const [originalData, setOriginalData] = useState<ProcessedRow[]>([]);
  const [bpSearch, setBpSearch] = useState("");
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);

  // Seed the editable copy + pristine baseline whenever fresh rows arrive.
  useEffect(() => {
    if (open && fetched) {
      setTableData(structuredClone(fetched));
      setOriginalData(structuredClone(fetched));
    }
  }, [fetched, open]);

  const { data: bpData = [] } = useBusinessPartnerSearch(bpSearch);
  const debouncedSetSearch = useDebouncedCallback(setBpSearch, 500);

  const saveProcessed = useSaveProcessed();
  const uploadToSap = useUploadToSap();

  const isDataSimilar = useMemo(
    () => JSON.stringify(tableData) === JSON.stringify(originalData),
    [tableData, originalData],
  );

  const incompleteRows = useMemo(
    () =>
      tableData.filter(
        (item) =>
          item.u_IsPaymentMade === "No" &&
          !(item.u_BPCode || item.u_AcctCode),
      ),
    [tableData],
  );

  const canUpload = useMemo(
    () =>
      tableData.some(
        (item) =>
          item.u_IsPaymentMade === "No" &&
          (item.u_BPCode || item.u_AcctCode),
      ) && isDataSimilar,
    [tableData, isDataSimilar],
  );

  // ─── Editing handlers ──────────────────────────────────────────────────────
  const handleDocTypeChange = (index: number, val: string) => {
    const next = structuredClone(tableData);
    next[index].u_DocType = val;
    next[index].u_BPName = "";
    next[index].u_BPCode = "";
    next[index].u_AcctName = "";
    next[index].u_AcctCode = "";
    setTableData(next);
  };

  const handleBpChange = (
    index: number,
    val: string,
    option: { cardCode?: string } | undefined,
    searchVal: string,
  ) => {
    const next = structuredClone(tableData);
    if (next[index].u_DocType === "A") {
      next[index].u_AcctCode = option?.cardCode || "";
      next[index].u_AcctName = val;
    } else {
      next[index].u_BPCode = option?.cardCode || "";
      next[index].u_BPName = val;
    }
    setTableData(next);
    debouncedSetSearch(searchVal);
  };

  // ─── Save / upload ─────────────────────────────────────────────────────────
  const resetAndClose = () => {
    setTableData([]);
    setOriginalData([]);
    setBpSearch("");
    onOpenChange(false);
  };

  const handleSave = () => {
    const payload: SaveProcessedRow[] = tableData.map((item) => ({
      docEntry: item.docEntry,
      lineId: item.lineId,
      u_DocType: item.u_DocType,
      ...bpAcctFields(item),
      u_CashRegCode: code,
    }));
    saveProcessed.mutate(payload, {
      onSuccess: () => {
        toast.success(t("successfullySaved"));
        resetAndClose();
      },
      onError: (err: unknown) => {
        toast.error(
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ?? t("common.error"),
        );
      },
    });
  };

  const doUpload = () => {
    if (!row) return;
    const payload: SapUploadRow[] = tableData
      .filter(
        (item) =>
          item.u_IsPaymentMade === "No" &&
          (item.u_BPCode || item.u_AcctCode),
      )
      .map((item) => ({
        docEntry: item.docEntry,
        docNum: item.docNum,
        u_Status: item.u_Status,
        u_PaymentType: item.u_PaymentType,
        u_DocDate: item.u_DocDate,
        u_PaidSum: item.u_PaidSum,
        u_ExchangeRate1: item.u_ExchangeRate1,
        u_ExchangeRate2: item.u_ExchangeRate2,
        u_Comment: item.u_Comment?.replace(/\s{2,}/g, " "),
        u_PaymentNum: item.u_PaymentNum,
        u_IsPaymentMade: item.u_IsPaymentMade,
        lineId: item.lineId,
        u_DocType: item.u_DocType,
        ...bpAcctFields(item),
        u_CashRegCode: code,
      }));

    uploadToSap.mutate(
      { draftCode: row.code, rows: payload },
      {
        onSuccess: () => {
          toast.success(t("successfullySaved"));
          setSkipConfirmOpen(false);
          resetAndClose();
        },
        onError: (err: unknown) => {
          toast.error(
            (err as { response?: { data?: { message?: string } } })?.response
              ?.data?.message ?? t("common.error"),
          );
        },
      },
    );
  };

  const handleUploadClick = () => {
    if (incompleteRows.length > 0) {
      setSkipConfirmOpen(true);
    } else {
      doUpload();
    }
  };

  // ─── Columns ───────────────────────────────────────────────────────────────
  const columns: ColumnsType<ProcessedRow> = [
    {
      title: t("paymentType"),
      dataIndex: "u_PaymentType",
      key: "u_PaymentType",
      render: (text: string) => (
        <Tag color={text === "Приход" ? "green" : "gold"}>{text}</Tag>
      ),
    },
    { title: "Line Id", dataIndex: "lineId", key: "lineId" },
    {
      title: t("docDate"),
      dataIndex: "u_DocDate",
      key: "u_DocDate",
      render: (v: string) => dayjs(v).format("DD.MM.YYYY HH:mm:ss"),
    },
    {
      title: t("paymentFor"),
      dataIndex: "u_DocType",
      key: "u_DocType",
      render: (text: string, record, index) => (
        <Select
          value={text || undefined}
          options={paymentFor}
          className="w-[160px]"
          getPopupContainer={(node) => node.parentElement ?? document.body}
          onChange={(val) => handleDocTypeChange(index, val)}
          disabled={record.u_IsPaymentMade === "Yes"}
        />
      ),
    },
    {
      title: t("bpName"),
      dataIndex: "u_BPName",
      key: "u_BPName",
      render: (_text: string, record, index) => {
        const value =
          record.u_DocType === "A" ? record.u_AcctName : record.u_BPName;
        const options = bpData
          .filter((item) => item.cardType === record.u_DocType)
          .map((item) => ({
            value: item.cardName,
            label:
              record.u_DocType === "A"
                ? `${item.cardName}-${item.cardCode}`
                : item.cardName,
            cardCode: item.cardCode,
          }));
        return (
          <Tooltip title={value}>
            <AutoComplete
              value={value}
              options={options}
              disabled={!record.u_DocType || record.u_IsPaymentMade === "Yes"}
              className="w-[250px]"
              getPopupContainer={(node) => node.parentElement ?? document.body}
              onChange={(val, option) =>
                handleBpChange(
                  index,
                  val,
                  option as { cardCode?: string },
                  val,
                )
              }
              onSelect={(val, option) =>
                handleBpChange(index, val, option as { cardCode?: string }, "")
              }
            />
          </Tooltip>
        );
      },
    },
    {
      title: t("cash"),
      key: "cash",
      render: () => <span>{code}</span>,
    },
    {
      title: t("paidSum"),
      dataIndex: "u_PaidSum",
      key: "u_PaidSum",
      render: (v: number) => numberWithSpacesIntl(v),
    },
    {
      title: t("docRate"),
      dataIndex: "u_ExchangeRate1",
      key: "u_ExchangeRate1",
      render: (v: number) => numberWithSpacesIntl(v),
    },
    {
      title: t("comment"),
      dataIndex: "u_Comment",
      key: "u_Comment",
      width: 200,
      render: (text: string) => (
        <Tooltip title={text}>
          <div className="cursor-pointer">{truncate(text)}</div>
        </Tooltip>
      ),
    },
    { title: t("paymentNum"), dataIndex: "u_PaymentNum", key: "u_PaymentNum" },
    {
      title: t("paymentIsMade"),
      dataIndex: "u_IsPaymentMade",
      key: "u_IsPaymentMade",
      render: (text: string) =>
        text === "Yes" ? t("paid") : text === "No" ? t("notPaid") : text,
    },
  ];

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          // Intercept every close attempt with an exit confirmation.
          if (!next) setExitConfirmOpen(true);
        }}
      >
        <DialogContent className="max-w-[90vw] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              <div className="space-y-1">
                <div>
                  {t("code")} - {row?.code}
                </div>
                <div>
                  {t("Tranzaksiyalar")} - {code}
                  {acctName ? `-${acctName}` : ""}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex justify-end gap-2">
            <Button
              onClick={handleSave}
              disabled={isDataSimilar || saveProcessed.isLoading}
            >
              {saveProcessed.isLoading && (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              )}
              {t("saveChanges")}
            </Button>
            <Button
              onClick={handleUploadClick}
              disabled={!canUpload || uploadToSap.isLoading}
            >
              {uploadToSap.isLoading && (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              )}
              {t("uploadToSAP")}
            </Button>
          </div>

          <div className="overflow-auto">
            <AntTable<ProcessedRow>
              columns={columns}
              dataSource={tableData}
              rowKey="lineId"
              loading={isLoading}
              pagination={false}
              scroll={{ x: 1200 }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Exit confirmation */}
      <ConfirmDialog
        open={exitConfirmOpen}
        onOpenChange={setExitConfirmOpen}
        title={t("saveChanges")}
        description={t("sureExit")}
        variant="warning"
        onConfirm={resetAndClose}
      />

      {/* Skip-incomplete confirmation before upload */}
      <ConfirmDialog
        open={skipConfirmOpen}
        onOpenChange={setSkipConfirmOpen}
        title={t("uploadToSAP")}
        description={t("skipIncompleteConfirm", {
          count: incompleteRows.length,
          lines: incompleteRows.map((item) => item.lineId).join(", "),
        })}
        variant="warning"
        loading={uploadToSap.isLoading}
        onConfirm={doUpload}
      />
    </>
  );
}
