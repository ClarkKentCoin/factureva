import { useEffect, useState } from "react";
import { PageBody, PageHeader, EmptyState } from "@/components/layout/PageScaffold";
import { supabase } from "@/integrations/supabase/client";

type Tenant = { id: string; name: string; slug: string | null; created_at: string };

export default function SuperAdminTenants() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  useEffect(() => {
    supabase.from("tenants").select("id,name,slug,created_at").order("created_at", { ascending: false })
      .then(({ data }) => setTenants(data ?? []));
  }, []);
  return (
    <PageBody>
      <PageHeader title="Tenants" description="All workspaces on the platform" />
      {!tenants ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : tenants.length === 0 ? (
        <EmptyState title="No tenants yet" description="Tenants will appear here as users sign up and create workspaces." />
      ) : (
        <div className="surface divide-y divide-border">
          {tenants.map((t) => (
            <div key={t.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-2">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.id}</div>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(t.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageBody>
  );
}
