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

interface Props {
  /** i18n key for the page title. */
  titleKey: string;
  /** Route prefix a row navigates into, e.g. "/bank-statements". */
  basePath: string;
  /**
   * When false, conversion accounts (`u_IsConvertationAccount === "Yes"`) are
   * filtered out (bank statements). When true, all accounts are listed
   * (act-sverka).
   */
  includeConversionAccounts?: boolean;
}

/**
 * Reusable accounts picker: lists accounts from `/accounts/menu` and drills into
 * a per-account page at `${basePath}/${acctCode}`.
 */
export function AccountsList({
  titleKey,
  basePath,
  includeConversionAccounts = false,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: accounts = [], isLoading } = useAccountsMenu();

  const rows = useMemo(
    () =>
      includeConversionAccounts
        ? accounts
        : accounts.filter((a) => a.u_IsConvertationAccount !== "Yes"),
    [accounts, includeConversionAccounts],
  );

  const columns: ColumnsType<AccountMenuItem> = [
    {
      title: t("code"),
      dataIndex: "acctCode",
      key: "acctCode",
      width: 160,
      render: (val) => <span className="font-mono text-sm">{val}</span>,
    },
    { title: t("fileName"), dataIndex: "acctName", key: "acctName" },
  ];

  return (
    <div className="relative min-h-full p-6 space-y-6">
      <PageHeader title={t(titleKey)} breadcrumbs={[{ label: t(titleKey) }]} />

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
            dataSource={rows}
            rowKey="acctCode"
            pagination={false}
            scroll={{ x: "max-content" }}
            onRow={(record) => ({
              onClick: () =>
                navigate(`${basePath}/${record.acctCode}`, {
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
