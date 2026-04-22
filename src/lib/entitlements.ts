/**
 * Entitlements / feature-gating layer.
 *
 * One central place to resolve:
 *  - the current effective plan for a tenant
 *  - boolean feature access (with tenant overrides)
 *  - numeric limits (with tenant overrides)
 *
 * UI components must NEVER hardcode `plan === "pro"` style logic.
 * They consume a single EntitlementSnapshot returned by `getEntitlementSnapshot`.
 *
 * Existing data is always readable. Only NEW premium-gated actions should
 * be blocked when a feature is not granted.
 */
import { supabase } from "@/integrations/supabase/client";

export type PlanCode = "free" | "beta" | "pro" | "business" | string;

export type FeatureKey =
  | "invoices.create"
  | "invoices.pdf_export"
  | "invoices.send_email"
  | "clients.manage"
  | "company.manage"
  | "country.fr"
  | "users.invite"
  | "quotes.create"
  | "credit_notes.create"
  | "reminders.send"
  | "branding.custom"
  | "reports.advanced"
  | "company.multiple_entities"
  | "api.access"
  | (string & {});

export type LimitKey =
  | "limit.max_clients"
  | "limit.max_invoices_per_month"
  | "limit.max_legal_entities"
  | "limit.max_storage_mb"
  | "limit.max_users"
  | (string & {});

export type EntitlementSnapshot = {
  tenantId: string;
  plan: { code: PlanCode; name: string; description: string | null } | null;
  subscriptionStatus: string | null;
  /** boolean features the tenant currently has access to */
  features: Record<string, boolean>;
  /** numeric limits (null = unlimited / not configured) */
  limits: Record<string, number | null>;
};

export const FREE_FALLBACK_PLAN_CODE: PlanCode = "free";

/**
 * Returns a single resolved entitlement snapshot for a tenant.
 * - Reads tenant_subscriptions to find active plan.
 * - Reads plan_features to get plan defaults.
 * - Applies tenant_feature_overrides on top.
 * - Falls back to a safe Free-equivalent snapshot if nothing is configured.
 */
export async function getEntitlementSnapshot(tenantId: string): Promise<EntitlementSnapshot> {
  const empty: EntitlementSnapshot = {
    tenantId,
    plan: null,
    subscriptionStatus: null,
    features: {},
    limits: {},
  };
  if (!tenantId) return empty;

  // 1. Active subscription (most recent active wins; fallback to most recent any)
  const { data: subs } = await supabase
    .from("tenant_subscriptions")
    .select("status, started_at, plan:plan_id(id, code, name, description, is_active)")
    .eq("tenant_id", tenantId)
    .order("started_at", { ascending: false });

  const active = (subs ?? []).find((s: any) => s.status === "active") ?? (subs ?? [])[0] ?? null;
  const plan = (active as any)?.plan ?? null;

  const snapshot: EntitlementSnapshot = {
    tenantId,
    plan: plan ? { code: plan.code, name: plan.name, description: plan.description } : null,
    subscriptionStatus: (active as any)?.status ?? null,
    features: {},
    limits: {},
  };

  // 2. Plan features
  if (plan?.id) {
    const { data: pf } = await supabase
      .from("plan_features")
      .select("enabled, limit_value, feature:feature_id(key, is_limit)")
      .eq("plan_id", plan.id);
    for (const row of pf ?? []) {
      const f: any = (row as any).feature;
      if (!f?.key) continue;
      if (f.is_limit) {
        snapshot.limits[f.key] = row.limit_value ?? null;
        // A limit feature being present also implies "enabled"
        snapshot.features[f.key] = !!row.enabled;
      } else {
        snapshot.features[f.key] = !!row.enabled;
      }
    }
  }

  // 3. Tenant overrides (override beats plan)
  const { data: overrides } = await supabase
    .from("tenant_feature_overrides")
    .select("enabled, limit_value, feature:feature_id(key, is_limit)")
    .eq("tenant_id", tenantId);

  for (const row of overrides ?? []) {
    const f: any = (row as any).feature;
    if (!f?.key) continue;
    if (typeof row.enabled === "boolean") snapshot.features[f.key] = row.enabled;
    if (f.is_limit && row.limit_value !== null && row.limit_value !== undefined) {
      snapshot.limits[f.key] = row.limit_value as unknown as number;
    }
  }

  // 4. Safety net — if no plan at all, behave like Free for core features.
  if (!snapshot.plan) {
    snapshot.features["invoices.create"] ??= true;
    snapshot.features["invoices.pdf_export"] ??= true;
    snapshot.features["clients.manage"] ??= true;
    snapshot.features["company.manage"] ??= true;
    snapshot.features["country.fr"] ??= true;
  }

  return snapshot;
}

export function hasFeature(snap: EntitlementSnapshot | null | undefined, key: FeatureKey): boolean {
  if (!snap) return false;
  return !!snap.features[key];
}

/** null means unlimited / unset. */
export function getLimit(snap: EntitlementSnapshot | null | undefined, key: LimitKey): number | null {
  if (!snap) return null;
  const v = snap.limits[key];
  return typeof v === "number" ? v : null;
}

/** True when a numeric limit is met or exceeded. unlimited => never reached. */
export function isLimitReached(
  snap: EntitlementSnapshot | null | undefined,
  key: LimitKey,
  currentUsage: number,
): boolean {
  const limit = getLimit(snap, key);
  if (limit === null) return false;
  return currentUsage >= limit;
}

export const canCreateDevis = (snap: EntitlementSnapshot | null | undefined) =>
  hasFeature(snap, "quotes.create");

export const canCreateInvoice = (snap: EntitlementSnapshot | null | undefined) =>
  hasFeature(snap, "invoices.create");
