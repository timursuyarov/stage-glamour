import { useState } from "react";
import { AutoComplete, Tooltip } from "antd";
import { useDebouncedCallback } from "@/lib/debounce";
import {
  useBusinessPartnerSearch,
  type BusinessPartner,
} from "@/entities/BankStatements/api";

interface Props {
  /** Displayed value (controlled by the parent). */
  value: string;
  /** Only BPs whose cardType matches are shown; "" shows all. */
  docType?: string;
  /** Fires on every keystroke with the raw typed text. */
  onChange?: (value: string) => void;
  /** Fires when an option is picked, with the full BP record. */
  onSelect?: (bp: BusinessPartner) => void;
  /** Append "-cardCode" to labels (used for account docType "A"). */
  labelWithCode?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Shared debounced business-partner autocomplete (500ms) used by the accountant
 * pages/modals. Wraps antd AutoComplete + `/bank-statements/business-partners`.
 */
export function BpAutoComplete({
  value,
  docType = "",
  onChange,
  onSelect,
  labelWithCode = false,
  disabled = false,
  placeholder,
  className = "w-full",
}: Props) {
  const [search, setSearch] = useState("");
  const setSearchDebounced = useDebouncedCallback(setSearch, 500);
  const { data: bps = [] } = useBusinessPartnerSearch(search);

  const options = bps
    .filter((bp) => (docType ? bp.cardType === docType : true))
    .map((bp) => ({
      value: bp.cardName,
      label:
        labelWithCode && bp.cardCode ? `${bp.cardName}-${bp.cardCode}` : bp.cardName,
      bp,
    }));

  return (
    <Tooltip title={value}>
      <AutoComplete
        value={value}
        options={options}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        // Render the dropdown inside its container so it works inside a
        // (modal) Radix Dialog, which otherwise blocks pointer events on
        // body-level portals.
        getPopupContainer={(node) => node.parentElement ?? document.body}
        onChange={(val) => {
          setSearchDebounced(val);
          onChange?.(val);
        }}
        onSelect={(_val, option) => {
          setSearchDebounced("");
          onSelect?.((option as unknown as { bp: BusinessPartner }).bp);
        }}
      />
    </Tooltip>
  );
}
