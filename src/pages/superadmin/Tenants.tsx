import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageBody, PageHeader, EmptyState } from "@/components/layout/PageScaffold";
import { supabase } from "@/integrations/supabase/client";

type Tenant = { id: string; name: string; slug: string | null; created_at: string };

export default function SuperAdminTenants() {
  const { t } = useTranslation();
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  useEffect(() => {
    supabase.from("tenants").select("id,name,slug,created_at").order("created_at", { ascending: false })
      .then(({ data }) => setTenants(data ?? []));
  }, []);
  return (
    <PageBody>
      <PageHeader title={t("superadmin.tenants.title")} description={t("superadmin.tenants.description")} />
      {!tenants ? (
        <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : tenants.length === 0 ? (
        <EmptyState title={t("superadmin.tenants.emptyTitle")} description={t("superadmin.tenants.emptyDescription")} />
      ) : (
        <div className="surface divide-y divide-border">
          {tenants.map((tn) => (
            <div key={tn.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-2">
              <div>
                <div className="font-medium">{tn.name}</div>
                <div className="text-xs text-muted-foreground">{tn.id}</div>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(tn.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageBody>
  );
}
