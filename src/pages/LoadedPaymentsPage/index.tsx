import { useMemo, useState, type UIEvent } from "react";
import { useTranslation } from "react-i18next";
import { Table as AntTable, Select, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleCard } from "@/components/ui/stat-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BpAutoComplete } from "@/components/BpAutoComplete";
import { numberWithSpacesIntl } from "@/lib/numberFormat";
import { switchCurrency } from "@/lib/money";
import { getToday } from "@/lib/dates";
import {
  usePaymentsInfinite,
  usePaymentsTotal,
  type PaymentRow,
  type PaymentsFilters,
} from "@/entities/Payments/api";

const truncate = (text?: string) =>
  text && text.length > 30 ? `${text.slice(0, 30)}...` : text ?? "";

export default function LoadedPaymentsPage() {
  const { t } = useTranslation();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(getToday());
  const [paymentType, setPaymentType] = useState("");
  const [docType, setDocType] = useState("");
  const [bpName, setBpName] = useState("");
  const [bpDisplay, setBpDisplay] = useState("");

  const filters: PaymentsFilters = useMemo(
    () => ({ startDate, endDate, paymentType, docType, bpName }),
    [startDate, endDate, paymentType, docType, bpName],
  );

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    usePaymentsInfinite(filters);
  const { data: total } = usePaymentsTotal(filters);
  const rows = useMemo(() => data?.pages.flat() ?? [], [data]);

  const totalAmount =
    paymentType === "Incoming"
      ? total?.incomingPaymentsTotal
      : paymentType === "Outgoing"
        ? total?.vendorPaymentsTotal
        : total?.saldo;

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

  const columns: ColumnsType<PaymentRow> = [
    { title: t("docNum"), dataIndex: "docNum", key: "docNum" },
    {
      title: t("docDate"),
      dataIndex: "docDate",
      key: "docDate",
      render: (v: string) => dayjs(v).format("DD.MM.YYYY"),
    },
    {
      title: t("paymentType"),
      dataIndex: "paymentType",
      key: "paymentType",
      render: (text: string) =>
        text === "Incoming" ? (
          <Tag className="rounded-xl" color="green">
            {t("Incoming")}
          </Tag>
        ) : (
          <Tag className="rounded-xl" color="red">
            {t("Outgoing")}
          </Tag>
        ),
    },
    { title: t("bpName"), dataIndex: "cardName", key: "cardName" },
    {
      title: t("paymentAmount"),
      dataIndex: "cashSum",
      key: "cashSum",
      render: (v: number, r) =>
        `${numberWithSpacesIntl(v)} ${switchCurrency(r.docCurr)}`,
    },
    {
      title: t("company"),
      dataIndex: "u_Firma",
      key: "u_Firma",
      render: (text: string) =>
        text ? (
          <Tooltip title={text}>
            <div className="cursor-pointer">{truncate(text)}</div>
          </Tooltip>
        ) : null,
    },
  ];

  return (
    <div className="relative min-h-full p-6 space-y-6">
      <PageHeader title={t("nav.loadedPayments")} />

      {/* Filters */}
      <ModuleCard title={t("filtersPayments")}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>{t("startDate")}</Label>
            <Input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("endDate")}</Label>
            <Input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("paymentType")}</Label>
            <Select
              value={paymentType}
              className="w-full"
              onChange={setPaymentType}
              options={[
                { value: "", label: t("all") },
                { value: "Incoming", label: t("Incoming") },
                { value: "Outgoing", label: t("Outgoing") },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("paymentFor")}</Label>
            <Select
              value={docType}
              className="w-full"
              onChange={(v) => {
                setDocType(v);
                setBpName("");
                setBpDisplay("");
              }}
              options={[
                { value: "", label: t("all") },
                { value: "A", label: t("account") },
                { value: "C", label: t("customer") },
                { value: "S", label: t("supplier") },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("bpName")}</Label>
            <BpAutoComplete
              value={bpDisplay}
              docType={docType}
              labelWithCode={docType === "A"}
              onChange={(v) => {
                setBpDisplay(v);
                if (!v) setBpName("");
              }}
              onSelect={(bp) => {
                setBpDisplay(bp.cardName);
                setDocType(bp.cardType);
                setBpName(bp.cardName);
              }}
            />
          </div>
        </div>
      </ModuleCard>

      {/* Table */}
      <ModuleCard title={t("nav.loadedPayments")} noPadding>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="max-h-[600px] overflow-auto" onScroll={handleScroll}>
            <AntTable<PaymentRow>
              columns={columns}
              dataSource={rows}
              rowKey="docNum"
              pagination={false}
              scroll={{ x: "max-content" }}
              summary={() => (
                <AntTable.Summary fixed>
                  <AntTable.Summary.Row>
                    <AntTable.Summary.Cell index={0} colSpan={4}>
                      <span className="font-semibold">{t("total")}</span>
                    </AntTable.Summary.Cell>
                    <AntTable.Summary.Cell index={4}>
                      <span className="font-semibold">
                        {`${numberWithSpacesIntl(totalAmount ?? 0)} so'm`}
                      </span>
                    </AntTable.Summary.Cell>
                    <AntTable.Summary.Cell index={5} />
                  </AntTable.Summary.Row>
                </AntTable.Summary>
              )}
            />
            {isFetchingNextPage && (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}
      </ModuleCard>
    </div>
  );
}
