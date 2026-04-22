/**
 * Superadmin helpers — thin layer over Supabase that:
 *  - aggregates platform metrics
 *  - lists tenants with derived counts
 *  - performs sensitive actions (plan change, override CRUD, suspend/reactivate)
 *
 * All writes go through standard Supabase calls; RLS already restricts these
 * tables to super_admin. Audit entries are written via `log_superadmin_action`
 * RPC (SECURITY DEFINER, super_admin only).
 */
import { supabase } from "@/integrations/supabase/client";

export type TenantRow = {
  id: string;
  name: string;
  slug: string | null;
  archived_at: string | null;
  suspended_at: string | null;
  created_at: string;
  created_by: string | null;
};

export type TenantListItem = TenantRow & {
  ownerEmail: string | null;
  ownerName: string | null;
  planCode: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  members: number;
  clients: number;
  invoices: number;
  devis: number;
};

export async function fetchPlatformOverview() {
  const [tenantsRes, profilesRes, clientsRes, invoicesRes, devisRes, subsRes, recentTenantsRes] = await Promise.all([
    supabase.from("tenants").select("id, suspended_at, archived_at", { count: "exact", head: false }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("document_type", "invoice"),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("document_type", "devis"),
    supabase
      .from("tenant_subscriptions")
      .select("status, plan:plan_id(code, name)")
      .eq("status", "active"),
    supabase
      .from("tenants")
      .select("id, name, created_at, suspended_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const tenants = tenantsRes.data ?? [];
  const totalTenants = tenants.length;
  const activeTenants = tenants.filter((t: any) => !t.suspended_at && !t.archived_at).length;

  const planDistribution = new Map<string, { code: string; name: string; count: number }>();
  for (const s of (subsRes.data ?? []) as any[]) {
    const code = s.plan?.code ?? "unknown";
    const name = s.plan?.name ?? code;
    const cur = planDistribution.get(code) ?? { code, name, count: 0 };
    cur.count += 1;
    planDistribution.set(code, cur);
  }

  return {
    totalTenants,
    activeTenants,
    totalUsers: profilesRes.count ?? 0,
    totalClients: clientsRes.count ?? 0,
    totalInvoices: invoicesRes.count ?? 0,
    totalDevis: devisRes.count ?? 0,
    planDistribution: Array.from(planDistribution.values()).sort((a, b) => b.count - a.count),
    recentTenants: (recentTenantsRes.data ?? []) as Array<{
      id: string; name: string; created_at: string; suspended_at: string | null;
    }>,
  };
}

export async function listTenantsForAdmin(): Promise<TenantListItem[]> {
  const { data: tenants, error } = await supabase
    .from("tenants")
    .select("id, name, slug, archived_at, suspended_at, created_at, created_by")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const list = (tenants ?? []) as TenantRow[];
  if (list.length === 0) return [];

  const ids = list.map((t) => t.id);
  const ownerIds = Array.from(new Set(list.map((t) => t.created_by).filter(Boolean) as string[]));

  const [members, clients, invoices, devis, subs, owners] = await Promise.all([
    supabase.from("tenant_members").select("tenant_id").in("tenant_id", ids),
    supabase.from("clients").select("tenant_id").in("tenant_id", ids),
    supabase.from("invoices").select("tenant_id").in("tenant_id", ids).eq("document_type", "invoice"),
    supabase.from("invoices").select("tenant_id").in("tenant_id", ids).eq("document_type", "devis"),
    supabase
      .from("tenant_subscriptions")
      .select("tenant_id, status, started_at, plan:plan_id(code, name)")
      .in("tenant_id", ids)
      .order("started_at", { ascending: false }),
    ownerIds.length
      ? supabase.from("profiles").select("id, email, full_name").in("id", ownerIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  const countBy = (rows: any[] | null | undefined) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.tenant_id, (m.get(r.tenant_id) ?? 0) + 1);
    return m;
  };
  const memberCount = countBy(members.data as any[]);
  const clientCount = countBy(clients.data as any[]);
  const invoiceCount = countBy(invoices.data as any[]);
  const devisCount = countBy(devis.data as any[]);

  // active sub per tenant (first wins because sorted by started_at desc)
  const subByTenant = new Map<string, any>();
  for (const s of (subs.data ?? []) as any[]) {
    if (!subByTenant.has(s.tenant_id)) subByTenant.set(s.tenant_id, s);
  }

  const ownerMap = new Map<string, { email: string | null; full_name: string | null }>();
  for (const o of (owners.data ?? []) as any[]) {
    ownerMap.set(o.id, { email: o.email ?? null, full_name: o.full_name ?? null });
  }

  return list.map((t) => {
    const sub = subByTenant.get(t.id);
    const owner = t.created_by ? ownerMap.get(t.created_by) : undefined;
    return {
      ...t,
      ownerEmail: owner?.email ?? null,
      ownerName: owner?.full_name ?? null,
      planCode: sub?.plan?.code ?? null,
      planName: sub?.plan?.name ?? null,
      subscriptionStatus: sub?.status ?? null,
      members: memberCount.get(t.id) ?? 0,
      clients: clientCount.get(t.id) ?? 0,
      invoices: invoiceCount.get(t.id) ?? 0,
      devis: devisCount.get(t.id) ?? 0,
    };
  });
}

export async function fetchTenantDetail(tenantId: string) {
  const [tenantRes, membersRes, subsRes, overridesRes, plansRes, featuresRes, recentAuditRes, ownerRes] =
    await Promise.all([
      supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle(),
      supabase.from("tenant_members").select("user_id, role, created_at").eq("tenant_id", tenantId),
      supabase
        .from("tenant_subscriptions")
        .select("id, status, started_at, ends_at, plan:plan_id(id, code, name)")
        .eq("tenant_id", tenantId)
        .order("started_at", { ascending: false }),
      supabase
        .from("tenant_feature_overrides")
        .select("id, enabled, limit_value, reason, created_at, feature:feature_id(id, key, name, is_limit)")
        .eq("tenant_id", tenantId),
      supabase.from("plans").select("id, code, name, is_active").eq("is_active", true).order("code"),
      supabase.from("features").select("id, key, name, is_limit").order("key"),
      supabase
        .from("audit_logs")
        .select("id, action, actor_type, actor_id, entity_type, entity_id, metadata, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(15),
      Promise.resolve(null), // placeholder, owner fetched after
    ]);

  const tenant = tenantRes.data as any;
  let owner: { id: string; email: string | null; full_name: string | null } | null = null;
  if (tenant?.created_by) {
    const { data: o } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", tenant.created_by)
      .maybeSingle();
    owner = (o as any) ?? null;
  }

  return {
    tenant,
    owner,
    members: membersRes.data ?? [],
    subscriptions: subsRes.data ?? [],
    overrides: overridesRes.data ?? [],
    plans: plansRes.data ?? [],
    features: featuresRes.data ?? [],
    recentAudit: recentAuditRes.data ?? [],
  };
}

/** Mark every existing active subscription as ended, then insert a new active one. */
export async function changeTenantPlan(tenantId: string, newPlanId: string, planCode: string) {
  const now = new Date().toISOString();

  const { data: previousActive } = await supabase
    .from("tenant_subscriptions")
    .select("id, plan:plan_id(code)")
    .eq("tenant_id", tenantId)
    .eq("status", "active");

  const { error: e1 } = await supabase
    .from("tenant_subscriptions")
    .update({ status: "ended", ends_at: now })
    .eq("tenant_id", tenantId)
    .eq("status", "active");
  if (e1) throw e1;

  const { error: e2 } = await supabase
    .from("tenant_subscriptions")
    .insert({ tenant_id: tenantId, plan_id: newPlanId, status: "active" });
  if (e2) throw e2;

  await supabase.rpc("log_superadmin_action", {
    _action: "plan.changed",
    _tenant_id: tenantId,
    _entity_type: "tenant_subscriptions",
    _entity_id: null,
    _metadata: {
      previous: (previousActive ?? []).map((s: any) => s.plan?.code ?? null),
      next: planCode,
    },
  });
}

export async function setTenantSuspended(tenantId: string, suspend: boolean) {
  const { error } = await supabase
    .from("tenants")
    .update({ suspended_at: suspend ? new Date().toISOString() : null })
    .eq("id", tenantId);
  if (error) throw error;

  await supabase.rpc("log_superadmin_action", {
    _action: suspend ? "tenant.suspended" : "tenant.reactivated",
    _tenant_id: tenantId,
    _entity_type: "tenants",
    _entity_id: tenantId,
    _metadata: {},
  });
}

export async function upsertFeatureOverride(args: {
  tenantId: string;
  featureId: string;
  featureKey: string;
  isLimit: boolean;
  enabled: boolean | null;
  limitValue: number | null;
  reason: string | null;
}) {
  const { tenantId, featureId, featureKey, isLimit, enabled, limitValue, reason } = args;

  const { data: existing } = await supabase
    .from("tenant_feature_overrides")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("feature_id", featureId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("tenant_feature_overrides")
      .update({
        enabled: isLimit ? null : enabled,
        limit_value: isLimit ? limitValue : null,
        reason: reason ?? null,
      })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("tenant_feature_overrides").insert({
      tenant_id: tenantId,
      feature_id: featureId,
      enabled: isLimit ? null : enabled,
      limit_value: isLimit ? limitValue : null,
      reason: reason ?? null,
    });
    if (error) throw error;
  }

  await supabase.rpc("log_superadmin_action", {
    _action: "override.upserted",
    _tenant_id: tenantId,
    _entity_type: "tenant_feature_overrides",
    _entity_id: featureId,
    _metadata: { feature: featureKey, enabled, limit_value: limitValue, reason },
  });
}

export async function deleteFeatureOverride(tenantId: string, overrideId: string, featureKey: string) {
  const { error } = await supabase
    .from("tenant_feature_overrides")
    .delete()
    .eq("id", overrideId);
  if (error) throw error;
  await supabase.rpc("log_superadmin_action", {
    _action: "override.removed",
    _tenant_id: tenantId,
    _entity_type: "tenant_feature_overrides",
    _entity_id: overrideId,
    _metadata: { feature: featureKey },
  });
}

export async function listSuperadminAudit(limit = 100) {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, tenant_id, actor_type, actor_id, action, entity_type, entity_id, metadata, created_at")
    .eq("actor_type", "super_admin")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/**
 * Aggregated read view for the Plans & Features console:
 *   - all plans (active + inactive)
 *   - all features
 *   - feature mappings per plan (enabled / limit_value)
 *   - count of tenants currently on each plan
 *
 * Read-only. Safe for super_admin to call.
 */
export async function fetchPlansOverview() {
  const [plansRes, featuresRes, mappingRes, subsRes] = await Promise.all([
    supabase.from("plans").select("id, code, name, description, is_active").order("code"),
    supabase.from("features").select("id, key, name, description, is_limit").order("key"),
    supabase.from("plan_features").select("plan_id, feature_id, enabled, limit_value"),
    supabase.from("tenant_subscriptions").select("plan_id, status").eq("status", "active"),
  ]);

  const plans = (plansRes.data ?? []) as Array<{
    id: string; code: string; name: string; description: string | null; is_active: boolean;
  }>;
  const features = (featuresRes.data ?? []) as Array<{
    id: string; key: string; name: string; description: string | null; is_limit: boolean;
  }>;
  const mapping = (mappingRes.data ?? []) as Array<{
    plan_id: string; feature_id: string; enabled: boolean; limit_value: number | null;
  }>;
  const subs = (subsRes.data ?? []) as Array<{ plan_id: string; status: string }>;

  const tenantCountByPlan = new Map<string, number>();
  for (const s of subs) {
    tenantCountByPlan.set(s.plan_id, (tenantCountByPlan.get(s.plan_id) ?? 0) + 1);
  }

  // featureId -> set of planIds where mapping exists
  const planFeatureIndex = new Map<string, Map<string, { enabled: boolean; limit_value: number | null }>>();
  for (const m of mapping) {
    if (!planFeatureIndex.has(m.plan_id)) planFeatureIndex.set(m.plan_id, new Map());
    planFeatureIndex.get(m.plan_id)!.set(m.feature_id, { enabled: m.enabled, limit_value: m.limit_value });
  }

  return {
    plans,
    features,
    tenantCountByPlan,
    planFeatureIndex,
  };
}
