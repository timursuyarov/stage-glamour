import { useState } from "react";
import { useTranslation } from "react-i18next";
import { message } from "antd";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  useDeleteLocalData,
  useLocalDataEntities,
  type LocalDataEntity,
} from "@/entities/LocalData/api";

interface LocalDataDeleteButtonProps {
  /** Which PostgreSQL-only dataset the row belongs to. */
  entity: LocalDataEntity;
  /** Primary key of the row to delete. */
  id: number;
  /** Short label identifying the row in the confirm dialog (name, doc number, ...). */
  rowLabel?: string;
  /** Called after the delete succeeds, so the page can refetch its own list. */
  onDeleted?: () => void;
  size?: "sm" | "icon";
}

/**
 * Per-row delete for data that lives only in PostgreSQL. Always confirms first
 * and spells out which dependent tables cascade, since the delete is permanent
 * and has no undo.
 *
 * Rendered only for admins — the backend endpoint is not permission-gated, so
 * this is a UI guard, not a security boundary.
 */
export function LocalDataDeleteButton({
  entity,
  id,
  rowLabel,
  onDeleted,
  size = "sm",
}: LocalDataDeleteButtonProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const deleteMutation = useDeleteLocalData();
  const { data: entities = [] } = useLocalDataEntities();

  if (user?.role !== "admin") return null;

  const info = entities.find((e) => e.entity === entity);
  const cascades = info?.cascadesInto ?? [];

  const handleConfirm = () => {
    deleteMutation.mutate(
      { filters: { Entity: entity, Ids: [id] } },
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
          onDeleted?.();
        },
        onError: () => {
          message.error(t("error.somethingWentWrong"));
        },
      },
    );
  };

  return (
    <>
      <Button
        variant="outline"
        size={size === "icon" ? "icon" : "sm"}
        className={
          size === "icon"
            ? "h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            : "gap-2 h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
        }
        onClick={() => setOpen(true)}
        disabled={deleteMutation.isLoading}
        title={t("localData.deleteRow")}
      >
        <Trash2 className="w-4 h-4" />
        {size !== "icon" && t("common.delete")}
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        variant="destructive"
        title={t("localData.deleteRowTitle")}
        confirmLabel={t("common.delete")}
        loading={deleteMutation.isLoading}
        onConfirm={handleConfirm}
        description={
          <span className="space-y-2 block">
            <span className="block">
              {t("localData.deleteRowBody", { row: rowLabel ?? `#${id}` })}
            </span>
            {cascades.length > 0 && (
              <span className="block text-xs">
                {t("localData.alsoRemoves")} {cascades.join(", ")}
              </span>
            )}
            <span className="block text-xs text-muted-foreground">
              {t("localData.irreversible")}
            </span>
          </span>
        }
      />
    </>
  );
}
