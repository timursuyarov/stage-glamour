import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "antd";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { BpAutoComplete } from "@/components/BpAutoComplete";
import { formatNumberWithSpaces, removeSpaces, removeSpacesComma } from "@/lib/money";
import dayjs from "dayjs";
import { getToday } from "@/lib/dates";
import { useCurrencyRate } from "@/entities/Cashier/api";
import {
  useCreateConversion,
  useUpdateConversion,
  type ConversionRow,
} from "@/entities/Convertations/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  /** The row being edited (edit mode only). */
  row?: ConversionRow | null;
}

/** Compute the derived rate fields from the entered values. */
function computeRates(
  currency: string,
  intConv: number,
  sumBp: number,
  usdToUzs: number,
) {
  const rubRate = currency === "RUB" && sumBp ? intConv / sumBp : 0;
  const crossRate = currency === "RUB" && rubRate ? usdToUzs / rubRate : 0;
  const usdRate = currency === "USD" && sumBp ? intConv / sumBp : usdToUzs;
  const paymSumCrosUsd = currency === "RUB" && crossRate ? sumBp / crossRate : sumBp;
  return { rubRate, crossRate, usdRate, paymSumCrosUsd };
}

export function ConversionDialog({ open, onOpenChange, mode, row }: Props) {
  const { t } = useTranslation();
  const isEdit = mode === "edit";

  const [docDate, setDocDate] = useState(getToday());
  const [docType, setDocType] = useState("");
  const [bpName, setBpName] = useState("");
  const [bpCode, setBpCode] = useState("");
  const [bpCurrency, setBpCurrency] = useState("");
  const [currency, setCurrency] = useState("");
  const [intConv, setIntConv] = useState("");
  const [paymentSumBp, setPaymentSumBp] = useState("");

  // Seed / reset when opening.
  useEffect(() => {
    if (!open) return;
    if (isEdit && row) {
      setDocDate(row.docDate ? dayjs(row.docDate).format("YYYY-MM-DD") : getToday());
      setDocType(row.docType);
      setBpName(row.bpOrAcctName);
      setBpCode(row.bpOrAcctCode);
      setBpCurrency("");
      setCurrency(row.docCur);
      setIntConv(String(row.intConv ?? ""));
      setPaymentSumBp(String(row.paymentSumBp ?? ""));
    } else {
      setDocDate(getToday());
      setDocType("");
      setBpName("");
      setBpCode("");
      setBpCurrency("");
      setCurrency("");
      setIntConv("");
      setPaymentSumBp("");
    }
  }, [open, isEdit, row]);

  const { data: usdToUzs } = useCurrencyRate("SUM", docDate, open);
  const { data: usdToRub } = useCurrencyRate("руб", docDate, open);

  const createConversion = useCreateConversion();
  const updateConversion = useUpdateConversion();
  const saving = createConversion.isLoading || updateConversion.isLoading;

  const onError = (err: unknown) => {
    toast.error(
      (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message ?? t("common.error"),
    );
  };

  const handleSubmit = () => {
    // Edit blocks submit when either exchange rate is missing.
    if (isEdit && (!usdToUzs || !usdToRub)) {
      toast.error(t("exchangeRateError", { date: docDate }));
      return;
    }

    const intConvStr = isEdit ? removeSpaces(intConv) : removeSpacesComma(intConv);
    const sumBpStr = isEdit ? removeSpaces(paymentSumBp) : removeSpacesComma(paymentSumBp);
    const { rubRate, crossRate, usdRate, paymSumCrosUsd } = computeRates(
      currency,
      Number(intConvStr),
      Number(sumBpStr),
      Number(usdToUzs ?? 0),
    );

    if (isEdit && row) {
      updateConversion.mutate(
        {
          docEntry: row.docEntry,
          docDate,
          docType,
          bpOrAcctCode: bpCode,
          bpOrAcctName: bpName,
          docCur: currency,
          intConv: intConvStr,
          paymentSumBp: sumBpStr,
          crossRate,
          rubRate,
          usdRate,
          paymSumCrosUsd,
          sapUsdToUzsRate: usdToUzs ?? null,
          sapUsdToRubRate: usdToRub ?? null,
          status: "NOT_UPLOADED",
        },
        {
          onSuccess: () => {
            toast.success(t("successfullySaved"));
            onOpenChange(false);
          },
          onError,
        },
      );
    } else {
      createConversion.mutate(
        {
          lineId: 0,
          u_DocType: docType,
          u_BPOrAcctCode: bpCode,
          u_BPOrAcctName: bpName,
          u_DocCur: currency,
          u_IntConv: intConvStr,
          u_PaymentSumBP: sumBpStr,
          u_CrossRate: crossRate,
          u_RubRate: rubRate,
          u_UsdRate: usdRate,
          u_PaymSumCrosUsd: paymSumCrosUsd,
          u_SapUsdToUzsRate: usdToUzs ?? null,
          u_SapUsdToRubRate: usdToRub ?? null,
          u_Status: "NOT_UPLOADED",
          u_DocDate: docDate,
        },
        {
          onSuccess: () => {
            toast.success(t("successfullySaved"));
            onOpenChange(false);
          },
          onError,
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("editConversion") : t("addConvertation")}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{t("paymentFor")}</Label>
            <Select
              value={docType || undefined}
              className="w-full"
              placeholder={t("paymentFor")}
              onChange={(v) => {
                setDocType(v);
                setBpName("");
                setBpCode("");
                setBpCurrency("");
              }}
              options={[
                { value: "A", label: t("account") },
                { value: "S", label: t("supplier") },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("date")}</Label>
            <Input
              type="date"
              value={docDate}
              onChange={(e) => setDocDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>{t("bpName")}</Label>
            <BpAutoComplete
              value={bpName}
              docType={docType}
              disabled={!docType}
              onChange={setBpName}
              onSelect={(bp) => {
                setBpName(bp.cardName);
                setBpCode(bp.cardCode);
                setBpCurrency(bp.currency ?? "");
              }}
            />
            {!docType && (
              <p className="text-xs text-destructive">{t("selectPaymentType")}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>{t("bpAccCurrency")}</Label>
            <Input value={bpCurrency} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>{t("convertationCurrency")}</Label>
            <Select
              value={currency || undefined}
              className="w-full"
              placeholder={t("convertationCurrency")}
              onChange={setCurrency}
              options={[
                { value: "USD", label: "USD" },
                { value: "RUB", label: "RUB" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("paidSumConvertation")}</Label>
            <Input
              value={formatNumberWithSpaces(intConv)}
              onChange={(e) => setIntConv(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("paidSumBp")}</Label>
            <Input
              value={formatNumberWithSpaces(paymentSumBp)}
              onChange={(e) => setPaymentSumBp(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={saving || !docType || !currency}
          >
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {isEdit ? t("saveChanges") : t("add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
