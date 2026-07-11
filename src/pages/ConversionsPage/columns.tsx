import type { ColumnsType } from "antd/es/table";
import type { TFunction } from "i18next";
import dayjs from "dayjs";
import { numberWithSpacesIntl } from "@/lib/numberFormat";
import { switchCurrency } from "@/lib/money";
import type { ConversionRow } from "@/entities/Convertations/api";

/** Render a derived rate cell (blank when not applicable). */
const rateCell = (suffix: string) => (v: number | "") =>
  v === "" || v == null ? "" : `${numberWithSpacesIntl(v)} ${suffix}`;

/** The 13 read-only conversion columns shared by the drafts + uploaded pages. */
export function conversionColumns(t: TFunction): ColumnsType<ConversionRow> {
  const switchDocType = (dt: string) =>
    dt === "S" ? t("supplier") : dt === "A" ? t("account") : dt;
  return [
    {
      title: t("paymentDate"),
      dataIndex: "docDate",
      key: "docDate",
      render: (v: string) => (v ? dayjs(v).format("DD-MM-YYYY") : "-"),
    },
    {
      title: t("paymentType"),
      dataIndex: "docType",
      key: "docType",
      render: switchDocType,
    },
    { title: t("bpAcc"), dataIndex: "bpOrAcctName", key: "bpOrAcctName" },
    { title: t("convertationCurrency"), dataIndex: "docCur", key: "docCur" },
    {
      title: t("paidSumConvertation"),
      dataIndex: "intConv",
      key: "intConv",
      render: (v: number) => `${numberWithSpacesIntl(v)} so'm`,
    },
    {
      title: t("paidSumBp"),
      dataIndex: "paymentSumBp",
      key: "paymentSumBp",
      render: (v: number, r) =>
        `${numberWithSpacesIntl(v)} ${switchCurrency(r.docCur)}`,
    },
    {
      title: t("converRateRUB"),
      dataIndex: "rubRate",
      key: "rubRate",
      render: rateCell("so'm"),
    },
    {
      title: t("converCrossRate"),
      dataIndex: "crossRate",
      key: "crossRate",
      render: rateCell("₽"),
    },
    {
      title: t("converUsdRate"),
      dataIndex: "usdRate",
      key: "usdRate",
      render: rateCell("so'm"),
    },
    {
      title: t("paymSumCrosUsd"),
      dataIndex: "paymSumCrosUsd",
      key: "paymSumCrosUsd",
      render: rateCell("$"),
    },
    {
      title: t("sapUSDUZSRate"),
      dataIndex: "sapUsdToUzsRate",
      key: "sapUsdToUzsRate",
      render: (v: number) => (v == null ? "" : `${numberWithSpacesIntl(v)} so'm`),
    },
    {
      title: t("sapUSDRUBRate"),
      dataIndex: "sapUsdToRubRate",
      key: "sapUsdToRubRate",
      render: (v: number) => (v == null ? "" : `${numberWithSpacesIntl(v)} ₽`),
    },
  ];
}
