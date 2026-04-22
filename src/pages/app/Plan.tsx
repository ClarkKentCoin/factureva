import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Sparkles, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEntitlements } from "@/hooks/use-entitlements";
import { PageBody, PageHeader } from "@/components/layout/PageScaffold";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PlanRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

type PlanFeatureRow = {
  enabled: boolean;
  limit_value: number | null;
  feature: { key: string; name: string; is_limit: boolean } | null;
};

const PLAN_ORDER = ["free", "beta", "pro", "business"];
// Features highlighted on the upgrade cards (boolean-style)
const HIGHLIGHTED_FEATURES = [
  "invoices.create",
  "invoices.pdf_export",
  "invoices.send_email",
  "quotes.create",
  "reminders.send",
  "branding.custom",
  "credit_notes.create",
  "reports.advanced",
  "company.multiple_entities",
  "api.access",
];
const HIGHLIGHTED_LIMITS = [
  "limit.max_clients",
  "limit.max_invoices_per_month",
  "limit.max_users",
  "limit.max_legal_entities",
];

export default function PlanPage() {
  const { t } = useTranslation();
  const { snapshot, loading } = useEntitlements();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [planFeatures, setPlanFeatures] = useState<Record<string, PlanFeatureRow[]>>({});

  useEffect(() => {
    (async () => {
      const { data: pl } = await supabase
        .from("plans").select("id, code, name, description, is_active").eq("is_active", true);
      const sorted = (pl ?? []).slice().sort(
        (a: any, b: any) => PLAN_ORDER.indexOf(a.code) - PLAN_ORDER.indexOf(b.code),
      ) as PlanRow[];
      setPlans(sorted);

      const { data: pf } = await supabase
        .from("plan_features")
        .select("plan_id, enabled, limit_value, feature:feature_id(key, name, is_limit)");
      const map: Record<string, PlanFeatureRow[]> = {};
      for (const row of (pf ?? []) as any[]) {
        (map[row.plan_id] ||= []).push({
          enabled: row.enabled, limit_value: row.limit_value, feature: row.feature,
        });
      }
      setPlanFeatures(map);
    })();
  }, []);

  const currentCode = snapshot?.plan?.code ?? null;

  const fmtLimit = (v: number | null) => v === null ? "—" : v >= 100000 ? "∞" : v.toLocaleString();

  const currentLimits = useMemo(() => snapshot?.limits ?? {}, [snapshot]);
  const currentFeatures = useMemo(() => snapshot?.features ?? {}, [snapshot]);

  return (
    <PageBody>
      <PageHeader
        title={t("billing.title")}
        description={t("billing.description")}
      />

      {/* Current plan summary */}
      <div className="surface p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("billing.currentPlan")}
            </div>
            <div className="font-serif text-2xl mt-1 flex items-center gap-2">
              {snapshot?.plan?.name ?? t("billing.noPlan")}
              {snapshot?.subscriptionStatus && (
                <Badge variant="outline" className="capitalize">
                  {snapshot.subscriptionStatus}
                </Badge>
              )}
            </div>
            {snapshot?.plan?.description && (
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                {snapshot.plan.description}
              </p>
            )}
          </div>
        </div>

        {/* Active limits at-a-glance */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {HIGHLIGHTED_LIMITS.map((k) => (
            <div key={k} className="rounded-md border border-border p-3">
              <div className="text-[11px] uppercase text-muted-foreground">
                {t(`billing.limits.${k}`, { defaultValue: k })}
              </div>
              <div className="font-mono text-lg mt-1">{fmtLimit(currentLimits[k] ?? null)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((p) => {
          const isCurrent = p.code === currentCode;
          const feats = planFeatures[p.id] ?? [];
          const featMap = new Map(feats.map((f) => [f.feature?.key, f]));
          return (
            <div
              key={p.id}
              className={cn(
                "surface p-5 flex flex-col",
                isCurrent && "ring-2 ring-primary",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="font-serif text-xl">{p.name}</div>
                {isCurrent ? (
                  <Badge>{t("billing.cards.current")}</Badge>
                ) : p.code === "pro" ? (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" />{t("billing.cards.popular")}
                  </Badge>
                ) : null}
              </div>
              {p.description && (
                <p className="text-sm text-muted-foreground mt-1 min-h-[40px]">{p.description}</p>
              )}

              <ul className="mt-4 space-y-2 text-sm flex-1">
                {HIGHLIGHTED_FEATURES.map((fk) => {
                  const granted = !!featMap.get(fk)?.enabled;
                  return (
                    <li key={fk} className="flex items-center gap-2">
                      {granted
                        ? <Check className="h-4 w-4 text-primary shrink-0" />
                        : <Lock className="h-4 w-4 text-muted-foreground/50 shrink-0" />}
                      <span className={granted ? "" : "text-muted-foreground/70 line-through"}>
                        {t(`billing.features.${fk}`, { defaultValue: fk })}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 space-y-1 text-xs text-muted-foreground border-t border-border pt-3">
                {HIGHLIGHTED_LIMITS.map((lk) => {
                  const f = featMap.get(lk);
                  return (
                    <div key={lk} className="flex items-center justify-between">
                      <span>{t(`billing.limits.${lk}`, { defaultValue: lk })}</span>
                      <span className="font-mono">{fmtLimit(f?.limit_value ?? null)}</span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4">
                {isCurrent ? (
                  <Button disabled variant="outline" className="w-full">
                    {t("billing.cards.current")}
                  </Button>
                ) : (
                  <Button disabled className="w-full" variant={p.code === "free" ? "outline" : "default"}>
                    {t("billing.cards.comingSoon")}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-6 text-center">
        {t("billing.contactNote")}
      </p>

      {loading && <div className="sr-only">{t("common.loading")}</div>}
    </PageBody>
  );
}
