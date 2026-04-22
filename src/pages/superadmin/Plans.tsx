import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Check, X } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/PageScaffold";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchPlansOverview } from "@/lib/superadmin";
import { cn } from "@/lib/utils";

type Overview = Awaited<ReturnType<typeof fetchPlansOverview>>;

// Beta plan code is treated as internal/invite-only in product packaging.
const INTERNAL_PLAN_CODES = new Set(["beta"]);

export default function SuperAdminPlans() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<Overview | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetchPlansOverview().then(setData).catch(() => setData({
      plans: [], features: [], tenantCountByPlan: new Map(), planFeatureIndex: new Map(),
    }));
  }, []);

  // Resolve a localized plan name from the billing.plans namespace, falling
  // back to the DB-provided name if no i18n key exists for that code.
  const planName = (code: string, fallback: string) => {
    const k = `billing.plans.${code}.name`;
    const v = t(k);
    return v === k ? fallback : v;
  };
  const planSubtitle = (code: string) => {
    const k = `billing.plans.${code}.subtitle`;
    const v = t(k);
    return v === k ? "" : v;
  };
  const planDescription = (code: string) => {
    const k = `billing.plans.${code}.description`;
    const v = t(k);
    return v === k ? "" : v;
  };
  // Localized feature label (booleans + limits live in two namespaces in i18n).
  const featureLabel = (key: string, fallback: string, isLimit: boolean) => {
    const ns = isLimit ? "billing.limits" : "billing.features";
    const k = `${ns}.${key}`;
    const v = t(k);
    return v === k ? fallback : v;
  };

  const orderedPlans = useMemo(() => {
    if (!data) return [];
    const order = ["free", "pro", "business", "beta"];
    return [...data.plans].sort((a, b) => {
      const ai = order.indexOf(a.code); const bi = order.indexOf(b.code);
      if (ai === -1 && bi === -1) return a.code.localeCompare(b.code);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [data]);

  return (
    <PageBody>
      <PageHeader title={t("superadmin.plans.title")} description={t("superadmin.plans.description")} />

      {!data ? (
        <div className="text-sm text-muted-foreground">{t("superadmin.common.loading")}</div>
      ) : (
        <div className="space-y-6">
          {/* Plans grid */}
          <section className="space-y-3">
            <h2 className="font-serif text-xl">{t("superadmin.plans.plans")}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {orderedPlans.map((p) => {
                const isInternal = INTERNAL_PLAN_CODES.has(p.code);
                const tenantCount = data.tenantCountByPlan.get(p.id) ?? 0;
                const isOpen = expanded === p.id;
                const planMap = data.planFeatureIndex.get(p.id) ?? new Map();
                const included = data.features.filter((f) => !f.is_limit && planMap.get(f.id)?.enabled);
                const excluded = data.features.filter((f) => !f.is_limit && !planMap.get(f.id)?.enabled);
                const limits = data.features.filter((f) => f.is_limit);

                return (
                  <article
                    key={p.id}
                    className={cn(
                      "surface p-4 sm:p-5 flex flex-col gap-3",
                      isInternal && "border border-dashed border-accent/40",
                    )}
                  >
                    <header className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-serif text-lg leading-tight truncate">
                            {planName(p.code, p.name)}
                          </h3>
                          <Badge variant="outline" className="text-[10px] uppercase">{p.code}</Badge>
                        </div>
                        {planSubtitle(p.code) && (
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            {planSubtitle(p.code)}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant={p.is_active ? "default" : "outline"}>
                          {p.is_active ? t("superadmin.plans.active") : t("superadmin.plans.inactive")}
                        </Badge>
                        <Badge variant={isInternal ? "secondary" : "outline"} className="text-[10px]">
                          {isInternal ? t("superadmin.plans.internal") : t("superadmin.plans.public")}
                        </Badge>
                      </div>
                    </header>

                    {planDescription(p.code) && (
                      <p className="text-sm text-muted-foreground">{planDescription(p.code)}</p>
                    )}

                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {t("superadmin.plans.tenantsOnPlan", { count: tenantCount })}
                      </span>
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setExpanded(isOpen ? null : p.id)}
                      >
                        {isOpen ? (
                          <><ChevronDown className="h-3.5 w-3.5 mr-1" /> {t("superadmin.plans.hideDetails")}</>
                        ) : (
                          <><ChevronRight className="h-3.5 w-3.5 mr-1" /> {t("superadmin.plans.showDetails")}</>
                        )}
                      </Button>
                    </div>

                    {isOpen && (
                      <div className="border-t border-border pt-3 space-y-3">
                        <PlanFeatureBlock
                          title={t("superadmin.plans.included")}
                          icon={<Check className="h-3.5 w-3.5 text-emerald-600" />}
                          rows={included.map((f) => ({ key: f.key, label: featureLabel(f.key, f.name, false) }))}
                        />
                        <PlanFeatureBlock
                          title={t("superadmin.plans.excluded")}
                          icon={<X className="h-3.5 w-3.5 text-muted-foreground" />}
                          rows={excluded.map((f) => ({ key: f.key, label: featureLabel(f.key, f.name, false) }))}
                          dim
                        />
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                            {t("superadmin.plans.limits")}
                          </div>
                          <ul className="space-y-1 text-sm">
                            {limits.map((f) => {
                              const m = planMap.get(f.id);
                              const v = m?.enabled === false
                                ? "—"
                                : m?.limit_value == null
                                  ? t("superadmin.plans.unlimited")
                                  : new Intl.NumberFormat(i18n.language).format(m.limit_value);
                              return (
                                <li key={f.id} className="flex items-center justify-between gap-2">
                                  <span className="min-w-0 truncate">
                                    {featureLabel(f.key, f.name, true)}
                                  </span>
                                  <span className="font-medium tabular-nums shrink-0">{v}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          {/* Features catalog */}
          <section className="surface p-4 sm:p-5">
            <h2 className="font-serif text-xl mb-3">{t("superadmin.plans.allFeatures")}</h2>
            <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
              <table className="w-full text-sm border-separate border-spacing-y-1 min-w-[480px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="font-medium pr-3">{t("superadmin.plans.features")}</th>
                    <th className="font-medium pr-3">{t("superadmin.plans.featureKey")}</th>
                    <th className="font-medium">{t("superadmin.plans.featureType")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.features.map((f) => (
                    <tr key={f.id} className="align-top">
                      <td className="pr-3 py-1.5">{f.is_limit
                        ? (() => { const k = `billing.limits.${f.key}`; const v = t(k); return v === k ? f.name : v; })()
                        : (() => { const k = `billing.features.${f.key}`; const v = t(k); return v === k ? f.name : v; })()}
                      </td>
                      <td className="pr-3 py-1.5">
                        <code className="text-[11px] text-muted-foreground break-all">{f.key}</code>
                      </td>
                      <td className="py-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {f.is_limit ? t("superadmin.plans.typeLimit") : t("superadmin.plans.typeBoolean")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </PageBody>
  );
}

function PlanFeatureBlock({
  title, icon, rows, dim,
}: {
  title: string;
  icon: React.ReactNode;
  rows: Array<{ key: string; label: string }>;
  dim?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">{title}</div>
      <ul className={cn("space-y-1 text-sm", dim && "text-muted-foreground")}>
        {rows.map((r) => (
          <li key={r.key} className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">{icon}</span>
            <span className="min-w-0 break-words">{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
