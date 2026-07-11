import { AccountsList } from "@/components/AccountsList";

/** Act-sverka — accounts list (all accounts). */
export default function ActSverkaAccountsPage() {
  return (
    <AccountsList
      titleKey="actSverka"
      basePath="/act-sverka"
      includeConversionAccounts
    />
  );
}
