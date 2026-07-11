import { AccountsList } from "@/components/AccountsList";

/**
 * Bank statements — accounts list. Conversion accounts belong to a separate
 * feature and are filtered out.
 */
export default function BankStatementsPage() {
  return (
    <AccountsList
      titleKey="bankStatements"
      basePath="/bank-statements"
      includeConversionAccounts={false}
    />
  );
}
