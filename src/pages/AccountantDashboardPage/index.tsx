import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Table as AntTable } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { numberWithSpaces2 } from "@/lib/numberFormat";
import { switchCurrency } from "@/lib/money";
import { getToday } from "@/lib/dates";
import {
  useDashboardAccounts,
  useExchangeRates,
  type ExchangeRateRow,
} from "@/entities/Dashboard/api";
import { ChangeRateDialog } from "./ChangeRateDialog";

const BASELINE_BANK = "Markaziy Bank";
const TREND_BANK = "Hamkor Bank";

export default function AccountantDashboardPage() {
  const { t } = useTranslation();
  const today = useMemo(() => getToday(), []);
  const { data: accounts = [], isLoading: accLoading } = useDashboardAccounts();
  const { data: rates = [], isLoading: ratesLoading } = useExchangeRates(today);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);

  const baseline = useMemo(
    () => rates.find((r) => r.u_Bank === BASELINE_BANK),
    [rates],
  );

  /** A rate cell with a "vs Markaziy Bank" percentage (shown only on Hamkor). */
  const rateCell = (
    value: number,
    record: ExchangeRateRow,
    baselineValue: number | undefined,
    suffix: string,
  ) => {
    const percent =
      baselineValue && baselineValue !== 0
        ? ((value - baselineValue) / baselineValue) * 100
        : 0;
    return (
      <div className="flex flex-col gap-1">
        <span>{`${numberWithSpaces2(value)} ${suffix}`}</span>
        {record.u_Bank === TREND_BANK && (
          <div
            className={`flex items-center gap-1 ${
              percent > 0 ? "text-status-success" : "text-status-error"
            }`}
          >
            {percent > 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span>{`${numberWithSpaces2(percent)}%`}</span>
          </div>
        )}
      </div>
    );
  };

  const columns: ColumnsType<ExchangeRateRow> = [
    { title: t("bankName"), dataIndex: "u_Bank", key: "u_Bank" },
    {
      title: "1 USD = SO'M",
      dataIndex: "u_USDtoUZS",
      key: "u_USDtoUZS",
      render: (v: number, r) => rateCell(v, r, baseline?.u_USDtoUZS, "so'm"),
    },
    {
      title: "1 RUB = SO'M",
      dataIndex: "u_RUBLtoUZS",
      key: "u_RUBLtoUZS",
      render: (v: number, r) => rateCell(v, r, baseline?.u_RUBLtoUZS, "so'm"),
    },
    {
      title: "1 USD = RUB",
      dataIndex: "u_USDtoRUBL",
      key: "u_USDtoRUBL",
      render: (v: number, r) => rateCell(v, r, baseline?.u_USDtoRUBL, "rub"),
    },
    {
      title: t("cashTotalInUSD"),
      dataIndex: "u_TotalSumInUSD",
      key: "u_TotalSumInUSD",
      render: (v: number) => `${numberWithSpaces2(v)} $`,
    },
    {
      title: t("cashTotalInRUB"),
      dataIndex: "u_TotalSumInRUBL",
      key: "u_TotalSumInRUBL",
      render: (v: number) => `${numberWithSpaces2(v)} rub`,
    },
  ];

  return (
    <div className="relative min-h-full p-6 space-y-6">
      <PageHeader title={t("nav.accountantDashboard")} />

      {/* Accounts cards */}
      <ModuleCard title={t("accounts")} noPadding>
        {accLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
            {accounts.map((card) => (
              <div
                key={card.acctCode}
                className="rounded-lg border border-border p-4 space-y-1"
              >
                <div className="text-sm font-semibold text-muted-foreground">
                  {card.acctCode} - {card.acctName}
                </div>
                <div className="text-2xl font-bold">
                  {`${numberWithSpaces2(card.currTotal)} ${switchCurrency(
                    card.docCurr,
                  )}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("lastPurchase")}: {card.docDate}
                </div>
              </div>
            ))}
          </div>
        )}
      </ModuleCard>

      {/* Exchange rates */}
      <ModuleCard
        title={t("exchangeRate")}
        noPadding
        actions={
          <Button size="sm" onClick={() => setRateDialogOpen(true)}>
            + {t("changeRate")}
          </Button>
        }
      >
        <AntTable<ExchangeRateRow>
          columns={columns}
          dataSource={rates}
          rowKey={(r) => String(r.code ?? r.u_Bank)}
          loading={ratesLoading}
          pagination={false}
          scroll={{ x: "max-content" }}
        />
      </ModuleCard>

      <ChangeRateDialog
        open={rateDialogOpen}
        onOpenChange={setRateDialogOpen}
        rates={rates}
      />
    </div>
  );
}
