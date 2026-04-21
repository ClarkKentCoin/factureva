import { useTranslation } from "react-i18next";
import { PageBody, PageHeader, EmptyState } from "@/components/layout/PageScaffold";

export default function SuperAdminAudit() {
  const { t } = useTranslation();
  return (
    <PageBody>
      <PageHeader title={t("superadmin.audit.title")} description={t("superadmin.audit.description")} />
      <EmptyState title={t("superadmin.audit.emptyTitle")} description={t("superadmin.audit.emptyDescription")} />
    </PageBody>
  );
}
