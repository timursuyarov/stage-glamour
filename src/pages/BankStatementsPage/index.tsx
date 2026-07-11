import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Table as AntTable } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleCard } from "@/components/ui/stat-card";
import {
  useAccountsMenu,
  type AccountMenuItem,
} from "@/entities/BankStatements/api";

/**
 * Bank statements — accounts list. Fetches the sidebar account menu and lets the
 * user drill into a per-account page. Conversion accounts
 * (`u_IsConvertationAccount === "Yes"`) belong to a separate feature that is not
 * built here, so they are filtered out.
 */
export default function BankStatementsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: accounts = [], isLoading } = useAccountsMenu();

  const bankAccounts = useMemo(
    () => accounts.filter((a) => a.u_IsConvertationAccount !== "Yes"),
    [accounts],
  );

  const columns: ColumnsType<AccountMenuItem> = [
    {
      title: t("code"),
      dataIndex: "acctCode",
      key: "acctCode",
      width: 160,
      render: (val) => <span className="font-mono text-sm">{val}</span>,
    },
    {
      title: t("fileName"),
      dataIndex: "acctName",
      key: "acctName",
    },
  ];

  return (
    <div className="relative min-h-full p-6 space-y-6">
      <PageHeader
        title={t("bankStatements")}
        breadcrumbs={[{ label: t("bankStatements") }]}
      />

      <ModuleCard noPadding>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">
              {t("common_loading")}
            </span>
          </div>
        ) : (
          <AntTable<AccountMenuItem>
            columns={columns}
            dataSource={bankAccounts}
            rowKey="acctCode"
            pagination={false}
            scroll={{ x: "max-content" }}
            onRow={(record) => ({
              onClick: () =>
                navigate(`/bank-statements/${record.acctCode}`, {
                  state: { acctName: record.acctName },
                }),
            })}
            rowClassName="cursor-pointer"
          />
        )}
      </ModuleCard>
    </div>
  );
}
