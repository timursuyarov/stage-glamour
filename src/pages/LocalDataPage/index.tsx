import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, DatePicker, Select, Modal, Checkbox, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { AlertTriangle, Eye, Loader2, Trash2 } from "lucide-react";
import dayjs from "dayjs";
import {
  useLocalDataEntities,
  useLocalDataPreview,
  useDeleteLocalData,
  isUnscoped,
  LOCAL_DATA_ENTITY_LABELS,
  PAGE_SIZE,
  type LocalDataEntity,
  type LocalDataEntityInfo,
  type LocalDataFilters,
  type LocalDataRow,
} from "@/entities/LocalData/api";

/**
 * Maintenance screen for purging the PostgreSQL-only datasets.
 *
 * The flow is deliberately preview-then-delete: the same filter drives both
 * calls, so the count shown in the confirm dialog is exactly what gets removed.
 */
export default function LocalDataPage() {
  const { t } = useTranslation();

  const [entity, setEntity] = useState<LocalDataEntity | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [applied, setApplied] = useState<LocalDataFilters | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  const { data: entities = [], isLoading: entitiesLoading } = useLocalDataEntities();
  const deleteMutation = useDeleteLocalData();

  const previewFilters = useMemo<LocalDataFilters | null>(
    () => (applied ? { ...applied, Skip: pageIndex * PAGE_SIZE, Take: PAGE_SIZE } : null),
    [applied, pageIndex],
  );

  const { data: preview, isLoading: previewLoading } = useLocalDataPreview(previewFilters);

  const selectedInfo: LocalDataEntityInfo | undefined = useMemo(
    () => entities.find((e) => e.entity === applied?.Entity),
    [entities, applied],
  );

  const handlePreview = () => {
    if (entity == null) {
      message.warning(t("localData.selectEntityFirst"));
      return;
    }
    setPageIndex(0);
    setApplied({
      Entity: entity,
      From: from || undefined,
      To: to || undefined,
    });
  };

  const handleClear = () => {
    setFrom("");
    setTo("");
    setPageIndex(0);
    setApplied(null);
  };

  const openConfirm = () => {
    setConfirmAll(false);
    setConfirmOpen(true);
  };

  const handleDelete = () => {
    if (!applied) return;

    const unscoped = isUnscoped(applied);
    if (unscoped && !confirmAll) {
      message.warning(t("localData.mustConfirmDeleteAll"));
      return;
    }

    deleteMutation.mutate(
      { filters: applied, confirmDeleteAll: unscoped },
      {
        onSuccess: (result) => {
          const cascaded = Object.values(result.cascadedCounts ?? {}).reduce(
            (sum, n) => sum + n,
            0,
          );
          message.success(
            t("localData.deleteSuccess", {
              count: result.deletedCount,
              cascaded,
            }),
          );
          setConfirmOpen(false);
          setPageIndex(0);
        },
        onError: () => {
          message.error(t("error.somethingWentWrong"));
        },
      },
    );
  };

  const columns: ColumnsType<LocalDataRow> = [
    {
      title: t("localData.id"),
      dataIndex: "id",
      key: "id",
      width: 100,
    },
    {
      title: t("localData.summary"),
      dataIndex: "summary",
      key: "summary",
    },
    {
      title: t("localData.createdAt"),
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      render: (value: string | null) =>
        value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "—",
    },
    {
      title: t("localData.childCount"),
      dataIndex: "childCount",
      key: "childCount",
      width: 140,
    },
  ];

  const unscoped = applied ? isUnscoped(applied) : true;
  const totalCount = preview?.totalCount ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("localData.title")}
        description={t("localData.description")}
        breadcrumbs={[{ label: t("localData.title") }]}
      />

      {/* Filters */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label className="text-xs">{t("localData.entity")}</Label>
          <Select
            value={entity ?? undefined}
            onChange={(value) => setEntity(value)}
            placeholder={t("localData.selectEntity")}
            className="h-9 w-full"
            loading={entitiesLoading}
            options={entities.map((e) => ({
              value: e.entity,
              label: `${t(LOCAL_DATA_ENTITY_LABELS[e.entity] ?? e.table)} (${e.rowCount})`,
            }))}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">{t("localData.from")}</Label>
          <DatePicker
            value={from ? dayjs(from) : null}
            onChange={(date) => setFrom(date ? date.format("YYYY-MM-DD") : "")}
            placeholder={t("localData.selectDate")}
            className="h-9 w-full"
            format="YYYY-MM-DD"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">{t("localData.to")}</Label>
          <DatePicker
            value={to ? dayjs(to) : null}
            onChange={(date) => setTo(date ? date.format("YYYY-MM-DD") : "")}
            placeholder={t("localData.selectDate")}
            className="h-9 w-full"
            format="YYYY-MM-DD"
          />
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={handlePreview} className="h-9">
            <Eye className="mr-2 h-4 w-4" />
            {t("localData.preview")}
          </Button>
          <Button variant="outline" onClick={handleClear} className="h-9">
            {t("common_clear_filters")}
          </Button>
        </div>
      </div>

      {/* Result summary + delete trigger */}
      {applied && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {t("localData.matchedRows", { count: totalCount })}
            </p>
            {selectedInfo && (
              <p className="text-xs text-muted-foreground">
                {selectedInfo.table}
                {selectedInfo.cascadesInto.length > 0 &&
                  ` → ${selectedInfo.cascadesInto.join(", ")}`}
              </p>
            )}
            {unscoped && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3" />
                {t("localData.unscopedWarning")}
              </p>
            )}
          </div>
          <Button
            variant="destructive"
            className="h-9"
            disabled={totalCount === 0 || previewLoading}
            onClick={openConfirm}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("localData.delete")}
          </Button>
        </div>
      )}

      {/* Preview table */}
      {applied && (
        <Table<LocalDataRow>
          rowKey="id"
          columns={columns}
          dataSource={preview?.items ?? []}
          loading={previewLoading}
          pagination={{
            current: pageIndex + 1,
            pageSize: PAGE_SIZE,
            total: totalCount,
            showSizeChanger: false,
            onChange: (page) => setPageIndex(page - 1),
          }}
        />
      )}

      {/* Confirm dialog */}
      <Modal
        open={confirmOpen}
        title={t("localData.confirmTitle")}
        onCancel={() => setConfirmOpen(false)}
        onOk={handleDelete}
        okText={t("localData.delete")}
        okButtonProps={{
          danger: true,
          loading: deleteMutation.isLoading,
          disabled: unscoped && !confirmAll,
        }}
        cancelText={t("common.cancel")}
      >
        <div className="space-y-3">
          <p className="text-sm">
            {t("localData.confirmBody", { count: totalCount })}
          </p>

          {selectedInfo && selectedInfo.cascadesInto.length > 0 && (
            <div className="rounded-md bg-muted p-3 text-xs">
              <p className="mb-1 font-medium">{t("localData.alsoRemoves")}</p>
              <ul className="list-inside list-disc">
                {selectedInfo.cascadesInto.map((table) => (
                  <li key={table}>{table}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {t("localData.irreversible")}
          </p>

          {unscoped && (
            <Checkbox
              checked={confirmAll}
              onChange={(e) => setConfirmAll(e.target.checked)}
            >
              <span className="text-sm text-destructive">
                {t("localData.confirmDeleteAll", {
                  table: selectedInfo?.table ?? "",
                })}
              </span>
            </Checkbox>
          )}

          {deleteMutation.isLoading && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("localData.deleting")}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
