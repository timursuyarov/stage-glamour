import { useState } from "react";
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
import {
  useBanks,
  useUpdateExchangeRate,
  type ExchangeRateRow,
} from "@/entities/Dashboard/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current exchange-rate rows — used to prefill USD/RUB for the picked bank. */
  rates: ExchangeRateRow[];
}

export function ChangeRateDialog({ open, onOpenChange, rates }: Props) {
  const { t } = useTranslation();
  const { data: banks = [] } = useBanks();
  const updateRate = useUpdateExchangeRate();

  const [bank, setBank] = useState("");
  const [code, setCode] = useState<string | number>("");
  const [usd, setUsd] = useState("");
  const [rub, setRub] = useState("");

  // Banks whose name mentions "SAP" are internal (the SAP rate) and excluded.
  const bankOptions = banks
    .filter((b) => !b.name?.includes("SAP") && !b.value?.includes("SAP"))
    .map((b) => ({ value: b.value, label: b.name }));

  const handleBankChange = (val: string) => {
    setBank(val);
    // Prefill from the matching exchange-rate row (matched on u_Bank, as source).
    const row = rates.find((r) => r.u_Bank === val);
    if (row) {
      setCode(row.code);
      setUsd(String(row.u_USDtoUZS ?? ""));
      setRub(String(row.u_RUBLtoUZS ?? ""));
    }
  };

  const reset = () => {
    setBank("");
    setCode("");
    setUsd("");
    setRub("");
  };

  const handleSubmit = () => {
    updateRate.mutate(
      {
        code: String(code),
        u_Bank: bank,
        u_USDtoUZS: Number(usd),
        u_RUBLtoUZS: Number(rub),
      },
      {
        onSuccess: () => {
          toast.success(t("successfullySaved"));
          reset();
          onOpenChange(false);
        },
        onError: (err: unknown) => {
          toast.error(
            (err as { response?: { data?: { message?: string } } })?.response
              ?.data?.message ?? t("common.error"),
          );
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("changeRate")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("bank")}</Label>
            <Select
              value={bank || undefined}
              options={bankOptions}
              onChange={handleBankChange}
              className="w-full"
              placeholder={t("bank")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("usdRate")}</Label>
            <Input value={usd} onChange={(e) => setUsd(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("rubRate")}</Label>
            <Input value={rub} onChange={(e) => setRub(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!bank || updateRate.isLoading}
          >
            {updateRate.isLoading && (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            )}
            {t("changeRate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
