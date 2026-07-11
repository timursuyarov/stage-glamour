import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Table as AntTable, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { Loader2, Pencil, Trash2, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/sonner";
import { numberWithSpacesIntl } from "@/lib/numberFormat";
import { removeSpaces } from "@/lib/money";
import {
  useConvertations,
  useDeleteConversion,
  useUploadConversionsToSap,
  type ConversionRow,
  type SapConversionRow,
} from "@/entities/Convertations/api";
import { ConversionDialog } from "./ConversionDialog";
import { conversionColumns } from "./columns";

export default function ConversionsPage() {
  const { t } = useTranslation();
  const { data: rows = [], isLoading } = useConvertations({
    status: "NOT_UPLOADED",
  });
  const deleteConversion = useDeleteConversion();
  const uploadToSap = useUploadConversionsToSap();

  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState<ConversionRow | null>(null);
  const [rowToDelete, setRowToDelete] = useState<ConversionRow | null>(null);

  const intConvTotal = useMemo(
    () => rows.reduce((sum, r) => sum + Number(removeSpaces(r.intConv)), 0),
    [rows],
  );

  const switchStatus = (s: string) =>
    s === "NOT_UPLOADED"
      ? t("notUploaded")
      : s === "uploaded" || s === "UPLOADED"
        ? t("uploaded")
        : s;

  const handleUploadToSap = () => {
    const payload: SapConversionRow[] = rows.map((r) => ({
      docEntry: r.docEntry,
      docType: r.docType,
      bpOrAcctCode: r.bpOrAcctCode,
      docCur: r.docCur,
      intConv: removeSpaces(r.intConv),
      paymentSumBp: removeSpaces(r.paymentSumBp),
      crossRate: r.docCur === "RUB" ? removeSpaces(r.crossRate) : 0,
      usdRate: removeSpaces(r.usdRate),
      docDate: dayjs(r.docDate).format("YYYY-MM-DD"),
    }));
    uploadToSap.mutate(payload, {
      onSuccess: () => {
        toast.success(t("successfullyUploaded"));
      },
      onError: (err: unknown) => {
        toast.error(
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ?? t("common.error"),
        );
      },
    });
  };

  const handleDelete = () => {
    if (!rowToDelete) return;
    deleteConversion.mutate(rowToDelete.docEntry, {
      onSuccess: () => {
        toast.success(t("successfullyDeleted"));
        setRowToDelete(null);
      },
      onError: (err: unknown) => {
        toast.error(
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ?? t("common.error"),
        );
      },
    });
  };

  const columns: ColumnsType<ConversionRow> = [
    ...conversionColumns(t),
    {
      title: t("status"),
      dataIndex: "status",
      key: "status",
      render: (s: string) => <Tag>{switchStatus(s)}</Tag>,
    },
    {
      title: "",
      key: "actions",
      align: "center",
      render: (_: unknown, record) => (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditRow(record)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setRowToDelete(record)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="relative min-h-full p-6 space-y-6">
      <PageHeader
        title={t("nav.conversions")}
        actions={
          <Button
            onClick={handleUploadToSap}
            disabled={!rows.length || uploadToSap.isLoading}
          >
            {uploadToSap.isLoading && (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            )}
            {t("uploadToSAP")}
          </Button>
        }
      />

      <ModuleCard noPadding>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <AntTable<ConversionRow>
            columns={columns}
            dataSource={rows}
            rowKey="docEntry"
            pagination={false}
            scroll={{ x: "max-content" }}
          />
        )}
        <div className="flex items-center justify-between gap-4 p-4 border-t border-border">
          <div className="text-sm">
            <span className="text-muted-foreground">{t("total")}: </span>
            <span className="font-semibold">
              {`${numberWithSpacesIntl(intConvTotal)} so'm`}
            </span>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            {t("add")}
          </Button>
        </div>
      </ModuleCard>

      <ConversionDialog mode="add" open={addOpen} onOpenChange={setAddOpen} />
      <ConversionDialog
        mode="edit"
        open={editRow != null}
        row={editRow}
        onOpenChange={(o) => !o && setEditRow(null)}
      />
      <ConfirmDialog
        open={rowToDelete != null}
        onOpenChange={(o) => !o && setRowToDelete(null)}
        title={t("delete")}
        description={t("sureDeleteDraft")}
        variant="destructive"
        confirmLabel={t("delete")}
        loading={deleteConversion.isLoading}
        onConfirm={handleDelete}
      />
    </div>
  );
}
