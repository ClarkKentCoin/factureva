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

export const SettingsPage = makePlaceholder("nav.settings", "placeholders.settings");
