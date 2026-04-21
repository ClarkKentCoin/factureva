import { useTranslation } from "react-i18next";
import { PageBody, PageHeader, StatCard, EmptyState } from "@/components/layout/PageScaffold";

export default function SuperAdminOverview() {
  const { t } = useTranslation();
  return (
    <PageBody>
      <PageHeader title={t("superadmin.overview.title")} description={t("superadmin.overview.description")} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label={t("superadmin.overview.tenants")} value="—" />
        <StatCard label={t("superadmin.overview.users")} value="—" />
        <StatCard label={t("superadmin.overview.subs")} value="—" />
      </div>
      <EmptyState
        title={t("superadmin.overview.emptyTitle")}
        description={t("superadmin.overview.emptyDescription")}
      />
    </PageBody>
  );
}
