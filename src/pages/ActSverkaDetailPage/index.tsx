import { useMemo, useState, type UIEvent } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Table as AntTable } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleCard } from "@/components/ui/stat-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { numberWithSpacesIntl } from "@/lib/numberFormat";
import { getToday, startOfMonth } from "@/lib/dates";
import {
  useAktSverkaInfinite,
  type AktSverkaRow,
} from "@/entities/Payments/api";

export default function ActSverkaDetailPage() {
  const { t } = useTranslation();
  const { id: acctCode = "" } = useParams();
  const location = useLocation();
  const acctName = (location.state as { acctName?: string } | null)?.acctName ?? "";

  const [startDate, setStartDate] = useState(startOfMonth());
  const [endDate, setEndDate] = useState(getToday());

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useAktSverkaInfinite(acctCode, startDate, endDate);
  const rows = useMemo(() => data?.pages.flat() ?? [], [data]);

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

  const columns: ColumnsType<AktSverkaRow> = [
    { title: t("transId"), dataIndex: "transId", key: "transId" },
    {
      title: t("date"),
      dataIndex: "dueDate",
      key: "dueDate",
      render: (v: string | null) => (v ? dayjs(v).format("DD.MM.YYYY") : "-"),
    },
    {
      title: t("incomingMoney"),
      dataIndex: "fcDebit",
      key: "fcDebit",
      render: (v: number) => numberWithSpacesIntl(v),
    },
    {
      title: t("outgoingMoney"),
      dataIndex: "fcCredit",
      key: "fcCredit",
      render: (v: number) => numberWithSpacesIntl(v),
    },
    { title: t("contraCode"), dataIndex: "contraAct", key: "contraAct" },
    { title: t("contraName"), dataIndex: "contraName", key: "contraName" },
    {
      title: t("cumulativeBalanceLC"),
      dataIndex: "cumulativeBalanceLC",
      key: "cumulativeBalanceLC",
      render: (v: number) => numberWithSpacesIntl(v),
    },
    {
      title: t("cumulativeBalanceFC"),
      dataIndex: "cumulativeBalanceFC",
      key: "cumulativeBalanceFC",
      render: (v: number) => numberWithSpacesIntl(v),
    },
  ];

  return (
    <div className="relative min-h-full p-6 space-y-6">
      <PageHeader
        title={`${t("actSverka")} — ${acctCode}${acctName ? ` ${acctName}` : ""}`}
        breadcrumbs={[
          { label: t("actSverka"), href: "/act-sverka" },
          { label: acctCode },
        ]}
      />

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
        </div>
      </ModuleCard>

      <ModuleCard title={t("actSverka")} noPadding>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="max-h-[600px] overflow-auto" onScroll={handleScroll}>
            <AntTable<AktSverkaRow>
              columns={columns}
              dataSource={rows}
              rowKey="transId"
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
    </div>
  );
}
