import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageBody, PageHeader, StatCard } from "@/components/layout/PageScaffold";
import { fetchPlatformOverview } from "@/lib/superadmin";
import { Badge } from "@/components/ui/badge";

export default function SuperAdminOverview() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPlatformOverview>> | null>(null);

  useEffect(() => {
    fetchPlatformOverview()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageBody>
      <PageHeader
        title={t("superadmin.overview.title")}
        description={t("superadmin.overview.description")}
      />

      {loading ? (
        <div className="text-sm text-muted-foreground">{t("superadmin.common.loading")}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <StatCard label={t("superadmin.overview.totalTenants")} value={String(data?.totalTenants ?? 0)} />
            <StatCard label={t("superadmin.overview.activeTenants")} value={String(data?.activeTenants ?? 0)} />
            <StatCard label={t("superadmin.overview.users")} value={String(data?.totalUsers ?? 0)} />
            <StatCard label={t("superadmin.overview.clients")} value={String(data?.totalClients ?? 0)} />
            <StatCard label={t("superadmin.overview.invoices")} value={String(data?.totalInvoices ?? 0)} />
            <StatCard label={t("superadmin.overview.devis")} value={String(data?.totalDevis ?? 0)} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="surface p-5">
              <h2 className="font-serif text-xl mb-3">{t("superadmin.overview.planDistribution")}</h2>
              {(data?.planDistribution ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("superadmin.overview.noActiveSubs")}</div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data!.planDistribution.map((p) => (
                    <li key={p.code} className="flex justify-between">
                      <span>{p.name} <span className="text-muted-foreground">({p.code})</span></span>
                      <span className="font-medium">{p.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="surface p-5">
              <h2 className="font-serif text-xl mb-3">{t("superadmin.overview.recentTenants")}</h2>
              {(data?.recentTenants ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("superadmin.overview.noRecent")}</div>
              ) : (
                <ul className="divide-y divide-border">
                  {data!.recentTenants.map((tn) => (
                    <li key={tn.id} className="py-2 flex items-center justify-between gap-3">
                      <Link to={`/superadmin/tenants/${tn.id}`} className="text-sm hover:underline truncate">
                        {tn.name}
                      </Link>
                      <div className="flex items-center gap-2 shrink-0">
                        {tn.suspended_at && (
                          <Badge variant="secondary">{t("superadmin.overview.suspended")}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(tn.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </PageBody>
  );
}
