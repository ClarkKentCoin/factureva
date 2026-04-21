import { useEffect, useState } from "react";
import { PageBody, PageHeader } from "@/components/layout/PageScaffold";
import { supabase } from "@/integrations/supabase/client";

type Plan = { id: string; code: string; name: string; description: string | null; is_active: boolean };
type Feature = { id: string; key: string; name: string; is_limit: boolean };

export default function SuperAdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  useEffect(() => {
    supabase.from("plans").select("*").order("code").then(({ data }) => setPlans(data ?? []));
    supabase.from("features").select("*").order("key").then(({ data }) => setFeatures(data ?? []));
  }, []);
  return (
    <PageBody>
      <PageHeader title="Plans & features" description="Entitlement-based monetization" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="surface p-5">
          <h2 className="font-serif text-xl mb-3">Plans</h2>
          <ul className="space-y-2 text-sm">
            {plans.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span><span className="font-medium">{p.name}</span> <span className="text-muted-foreground">({p.code})</span></span>
                <span className="text-xs text-muted-foreground">{p.is_active ? "active" : "inactive"}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="surface p-5">
          <h2 className="font-serif text-xl mb-3">Features</h2>
          <ul className="space-y-1.5 text-sm">
            {features.map((f) => (
              <li key={f.id} className="flex justify-between">
                <span className="truncate">{f.name}</span>
                <code className="text-xs text-muted-foreground">{f.key}</code>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PageBody>
  );
}
