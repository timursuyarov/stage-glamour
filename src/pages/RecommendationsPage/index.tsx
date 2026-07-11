import { useMemo, useState, type UIEvent } from "react";
import { useTranslation } from "react-i18next";
import { Table as AntTable, Select } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleCard } from "@/components/ui/stat-card";
import { Label } from "@/components/ui/label";
import { BpAutoComplete } from "@/components/BpAutoComplete";
import {
  useRecommendationsInfinite,
  type RecommendationRow,
  type RecommendationsFilters,
} from "@/entities/BankStatements/api";

export default function RecommendationsPage() {
  const { t } = useTranslation();

  const [docType, setDocType] = useState("");
  const [bpCode, setBpCode] = useState("");
  const [bpDisplay, setBpDisplay] = useState("");

  const filters: RecommendationsFilters = useMemo(
    () => ({ docType, bpCode }),
    [docType, bpCode],
  );

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useRecommendationsInfinite(filters);
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

  const columns: ColumnsType<RecommendationRow> = [
    {
      title: t("paymentFor"),
      dataIndex: "u_DocType",
      key: "u_DocType",
      render: (v: string) =>
        v === "A"
          ? t("account")
          : v === "C"
            ? t("customer")
            : v === "S"
              ? t("supplier")
              : v,
    },
    {
      title: t("bpCode"),
      dataIndex: "u_AcctCode",
      key: "u_AcctCode",
      render: (v: string, r) => (r.u_DocType === "A" ? v : r.u_BPCode),
    },
    {
      title: t("bpName"),
      dataIndex: "u_AcctName",
      key: "u_AcctName",
      render: (v: string, r) => (r.u_DocType === "A" ? v : r.u_BPName),
    },
    { title: t("keyword"), dataIndex: "u_Keyword", key: "u_Keyword" },
    { title: t("currency"), dataIndex: "u_BPCurrency", key: "u_BPCurrency" },
  ];

  return (
    <div className="relative min-h-full p-6 space-y-6">
      <PageHeader title={t("nav.recommendations")} />

      <ModuleCard title={t("filterRecommendations")}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>{t("naming")}</Label>
            <BpAutoComplete
              value={bpDisplay}
              docType={docType}
              onChange={(v) => {
                setBpDisplay(v);
                if (!v) setBpCode("");
              }}
              onSelect={(bp) => {
                setBpDisplay(bp.cardName);
                setBpCode(bp.cardCode);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("Tasnif")}</Label>
            <Select
              value={docType}
              className="w-full"
              onChange={(v) => {
                setDocType(v);
                setBpCode("");
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
        </div>
      </ModuleCard>

      <ModuleCard noPadding>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="max-h-[600px] overflow-auto" onScroll={handleScroll}>
            <AntTable<RecommendationRow>
              columns={columns}
              dataSource={rows}
              rowKey="docNum"
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
