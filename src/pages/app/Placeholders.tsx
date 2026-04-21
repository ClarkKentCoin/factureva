import { useTranslation } from "react-i18next";
import { PageBody, PageHeader, EmptyState } from "@/components/layout/PageScaffold";

export function makePlaceholder(titleKey: string, bodyKey: string) {
  return function PlaceholderPage() {
    const { t } = useTranslation();
    return (
      <PageBody>
        <PageHeader title={t(titleKey)} />
        <EmptyState title={t("common.comingSoon")} description={t(bodyKey)} />
      </PageBody>
    );
  };
}

export const InvoicesPage = makePlaceholder("nav.invoices", "placeholders.invoices");
export const ClientsPage = makePlaceholder("nav.clients", "placeholders.clients");
export const ItemsPage = makePlaceholder("nav.items", "placeholders.items");
export const ActivitiesPage = makePlaceholder("nav.activities", "placeholders.activities");
export const CompanyPage = makePlaceholder("nav.company", "placeholders.company");
export const SettingsPage = makePlaceholder("nav.settings", "placeholders.settings");
