import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Table as AntTable, Select } from "antd";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleCard } from "@/components/ui/stat-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BpAutoComplete } from "@/components/BpAutoComplete";
import { numberWithSpacesIntl } from "@/lib/numberFormat";
import { removeSpaces } from "@/lib/money";
import { getToday } from "@/lib/dates";
import {
  useConvertations,
  type ConversionRow,
} from "@/entities/Convertations/api";
import { conversionColumns } from "../ConversionsPage/columns";

export default function ConversionsUploadedPage() {
  const { t } = useTranslation();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(getToday());
  const [docType, setDocType] = useState("");
  const [bpName, setBpName] = useState("");
  const [bpDisplay, setBpDisplay] = useState("");
  const [currency, setCurrency] = useState("");

  const { data: rows = [], isLoading } = useConvertations({
    status: "UPLOADED",
    docType,
    bpName,
    startDate,
    endDate,
    currency,
  });

  const intConvTotal = useMemo(
    () => rows.reduce((sum, r) => sum + Number(removeSpaces(r.intConv)), 0),
    [rows],
  );

  const columns = conversionColumns(t);

  return (
    <div className="relative min-h-full p-6 space-y-6">
      <PageHeader title={t("nav.conversionsUploaded")} />

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
                { value: "S", label: t("supplier") },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("bpName")}</Label>
            <BpAutoComplete
              value={bpDisplay}
              docType={docType}
              onChange={(v) => {
                setBpDisplay(v);
                if (!v) setBpName("");
              }}
              onSelect={(bp) => {
                setBpDisplay(bp.cardName);
                setBpName(bp.cardName);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("convertationCurrency")}</Label>
            <Select
              value={currency}
              className="w-full"
              onChange={setCurrency}
              options={[
                { value: "", label: t("all") },
                { value: "USD", label: "USD" },
                { value: "RUB", label: "RUB" },
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
          <AntTable<ConversionRow>
            columns={columns}
            dataSource={rows}
            rowKey="docEntry"
            pagination={false}
            scroll={{ x: "max-content" }}
          />
        )}
        <div className="p-4 border-t border-border text-sm">
          <span className="text-muted-foreground">{t("total")}: </span>
          <span className="font-semibold">
            {`${numberWithSpacesIntl(intConvTotal)} so'm`}
          </span>
        </div>
      </ModuleCard>
    </div>
  );
}
