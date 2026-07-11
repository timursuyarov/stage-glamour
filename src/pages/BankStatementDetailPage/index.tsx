import { useMemo, useRef, useState, type UIEvent } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Table as AntTable, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { Eye, FileText, Trash2, Upload as UploadIcon, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/sonner";
import {
  useUploadedDraftsInfinite,
  useUploadExcel,
  useDeleteDraft,
  type UploadedDraft,
} from "@/entities/BankStatements/api";
import { OriginalFileDialog } from "./OriginalFileDialog";
import { ProcessedFileDialog } from "./ProcessedFileDialog";

const EXCEL_MIME_TYPES = [
  "application/vnd.ms-excel", // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
];

export default function BankStatementDetailPage() {
  const { t } = useTranslation();
  const { id: code = "" } = useParams();
  const location = useLocation();
  const acctName = (location.state as { acctName?: string } | null)?.acctName ?? "";

  // ─── Upload state ──────────────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const uploadExcel = useUploadExcel();

  const validateFile = (candidate?: File | null) => {
    if (!candidate) return;
    if (EXCEL_MIME_TYPES.includes(candidate.type)) {
      setFileName(candidate.name);
      setError("");
      setFile(candidate);
    } else {
      setFileName("");
      setFile(null);
      setError(t("invalidExcelFile"));
    }
  };

  const handleUpload = () => {
    if (!file) return;
    uploadExcel.mutate(
      { code, file },
      {
        onSuccess: () => {
          toast.success(t("successfullyUploaded"));
          setFile(null);
          setFileName("");
        },
        onError: (err: unknown) => {
          toast.error(
            (err as { response?: { data?: { message?: string } } })?.response
              ?.data?.message ?? t("uploadFailed"),
          );
        },
      },
    );
  };

  // ─── Drafts list (infinite scroll) ─────────────────────────────────────────
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useUploadedDraftsInfinite(code);
  const drafts = useMemo(() => data?.pages.flat() ?? [], [data]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (
      scrollTop + clientHeight >= scrollHeight - 20 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  };

  // ─── Row actions ───────────────────────────────────────────────────────────
  const [originalRow, setOriginalRow] = useState<UploadedDraft | null>(null);
  const [processedRow, setProcessedRow] = useState<UploadedDraft | null>(null);
  const [rowToDelete, setRowToDelete] = useState<UploadedDraft | null>(null);
  const deleteDraft = useDeleteDraft();

  const handleDeleteConfirm = () => {
    if (!rowToDelete) return;
    deleteDraft.mutate(rowToDelete.code, {
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

  const columns: ColumnsType<UploadedDraft> = [
    { title: t("code"), dataIndex: "code", key: "code" },
    { title: t("fileName"), dataIndex: "name", key: "name" },
    {
      title: t("addedDate"),
      dataIndex: "u_AddedDate",
      key: "u_AddedDate",
      render: (text: string | null) =>
        text ? dayjs(text).format("DD-MM-YYYY HH:mm:ss") : "-",
    },
    {
      title: t("status"),
      dataIndex: "u_UploadStatus",
      key: "u_UploadStatus",
      render: (text: string) =>
        text === "Completed" ? (
          <Tag className="rounded-xl" color="green">
            {t("Completed")}
          </Tag>
        ) : text === "Pending" ? (
          <Tag className="rounded-xl" color="gold">
            {t("Pending")}
          </Tag>
        ) : (
          <Tag className="rounded-xl" color="red">
            {text}
          </Tag>
        ),
    },
    {
      title: "",
      key: "actions",
      align: "center",
      render: (_: unknown, record) => (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOriginalRow(record)}
          >
            <Eye className="w-4 h-4 mr-1" />
            {t("original")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setProcessedRow(record)}
          >
            <FileText className="w-4 h-4 mr-1" />
            {t("processed")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setRowToDelete(record)}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            {t("delete")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="relative min-h-full p-6 space-y-6">
      <PageHeader
        title={`${t("bankStatements")} — ${code}${acctName ? ` ${acctName}` : ""}`}
        breadcrumbs={[
          { label: t("bankStatements"), href: "/bank-statements" },
          { label: code },
        ]}
      />

      {/* Upload card */}
      <ModuleCard title={t("uploadFile")}>
        <div className="flex items-center gap-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              validateFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex-1 cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
              dragOver ? "border-primary" : "border-border"
            }`}
          >
            <input
              type="file"
              accept=".xls,.xlsx"
              id="bankStatementFileInput"
              className="hidden"
              onChange={(e) => validateFile(e.target.files?.[0])}
            />
            <label
              htmlFor="bankStatementFileInput"
              className="cursor-pointer"
            >
              {fileName && file ? (
                <span className="font-medium text-primary">{fileName}</span>
              ) : (
                <span className="flex items-center justify-center gap-2 text-lg text-muted-foreground">
                  <UploadIcon className="w-5 h-5" />
                  {t("dropExcel")}
                </span>
              )}
            </label>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </div>
          <Button
            disabled={!file || uploadExcel.isLoading}
            onClick={handleUpload}
          >
            {uploadExcel.isLoading && (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            )}
            {t("upload")}
          </Button>
        </div>
      </ModuleCard>

      {/* Drafts table */}
      <ModuleCard title={t("Uploaded Payment Drafts")} noPadding>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">
              {t("common_loading")}
            </span>
          </div>
        ) : (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="max-h-[600px] overflow-auto"
          >
            <AntTable<UploadedDraft>
              columns={columns}
              dataSource={drafts}
              rowKey="code"
              pagination={false}
              scroll={{ x: "max-content" }}
            />
            {isFetchingNextPage && (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}
      </ModuleCard>

      {/* Dialogs */}
      <OriginalFileDialog
        open={originalRow != null}
        row={originalRow}
        code={code}
        onOpenChange={(open) => !open && setOriginalRow(null)}
      />
      <ProcessedFileDialog
        open={processedRow != null}
        row={processedRow}
        code={code}
        acctName={acctName}
        onOpenChange={(open) => !open && setProcessedRow(null)}
      />
      <ConfirmDialog
        open={rowToDelete != null}
        onOpenChange={(open) => !open && setRowToDelete(null)}
        title={t("delete")}
        description={t("sureDeleteDraft")}
        variant="destructive"
        confirmLabel={t("delete")}
        loading={deleteDraft.isLoading}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
