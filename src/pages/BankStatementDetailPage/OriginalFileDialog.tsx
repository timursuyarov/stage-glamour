import { useTranslation } from "react-i18next";
import { Table as AntTable, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { numberWithSpacesIntl } from "@/lib/numberFormat";
import {
  useOriginalRows,
  type OriginalRow,
  type UploadedDraft,
} from "@/entities/BankStatements/api";

interface Props {
  open: boolean;
  row: UploadedDraft | null;
  code: string;
  onOpenChange: (open: boolean) => void;
}

const truncate = (text?: string) =>
  text && text.length > 30 ? `${text.slice(0, 30)}...` : text ?? "";

export function OriginalFileDialog({ open, row, code, onOpenChange }: Props) {
  const { t } = useTranslation();
  const { data: rows = [], isLoading } = useOriginalRows(
    row?.u_OriginalDataID,
    open,
  );

  const columns: ColumnsType<OriginalRow> = [
    { title: t("paymentNum"), dataIndex: "u_PaymentNum", key: "u_PaymentNum" },
    { title: t("companyName"), dataIndex: "u_CompanyName", key: "u_CompanyName" },
    {
      title: t("paymentDate"),
      dataIndex: "u_PaymentDate",
      key: "u_PaymentDate",
      render: (v: string) => dayjs(v).format("DD.MM.YYYY HH:mm:ss"),
    },
    {
      title: t("debit2"),
      dataIndex: "u_Debit",
      key: "u_Debit",
      render: (v: number) => numberWithSpacesIntl(v),
    },
    {
      title: t("credit2"),
      dataIndex: "u_Credit",
      key: "u_Credit",
      render: (v: number) => numberWithSpacesIntl(v),
    },
    {
      title: t("comment"),
      dataIndex: "u_Description",
      key: "u_Description",
      render: (text: string) => (
        <Tooltip title={text}>
          <div className="cursor-pointer">{truncate(text)}</div>
        </Tooltip>
      ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {t("outgoingOriginalPayments")} - {code}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-auto">
          <AntTable<OriginalRow>
            columns={columns}
            dataSource={rows}
            rowKey={(_, i) => String(i)}
            loading={isLoading}
            pagination={false}
            scroll={{ x: "max-content" }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
