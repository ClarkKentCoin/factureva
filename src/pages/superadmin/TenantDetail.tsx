import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageBody, PageHeader, EmptyState } from "@/components/layout/PageScaffold";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  changeTenantPlan, deleteFeatureOverride, fetchTenantDetail,
  setTenantSuspended, upsertFeatureOverride,
} from "@/lib/superadmin";
import { getEntitlementSnapshot, type EntitlementSnapshot } from "@/lib/entitlements";

type Detail = Awaited<ReturnType<typeof fetchTenantDetail>>;

export default function SuperAdminTenantDetail() {
  const { t } = useTranslation();
  const { tenantId = "" } = useParams();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [snap, setSnap] = useState<EntitlementSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        fetchTenantDetail(tenantId),
        getEntitlementSnapshot(tenantId),
      ]);
      setDetail(d);
      setSnap(s);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { void reload(); }, [reload]);

  // Plan change dialog
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<string>("");

  // Suspend confirm
  const [suspendOpen, setSuspendOpen] = useState(false);

  // Override dialog
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [ovFeatureId, setOvFeatureId] = useState<string>("");
  const [ovEnabled, setOvEnabled] = useState<"true" | "false">("true");
  const [ovLimit, setOvLimit] = useState<string>("");
  const [ovReason, setOvReason] = useState<string>("");
  const ovFeature = useMemo(
    () => detail?.features.find((f: any) => f.id === ovFeatureId) ?? null,
    [detail, ovFeatureId],
  );

  if (loading || !detail) {
    return (
      <PageBody>
        <div className="text-sm text-muted-foreground">{t("superadmin.common.loading")}</div>
      </PageBody>
    );
  }

  if (!detail.tenant) {
    return (
      <PageBody>
        <PageHeader title={t("superadmin.detail.notFound")} />
        <Button asChild variant="outline" size="sm">
          <Link to="/superadmin/tenants">{t("superadmin.detail.back")}</Link>
        </Button>
      </PageBody>
    );
  }

  const tenant = detail.tenant as any;
  const activeSub = (detail.subscriptions as any[]).find((s) => s.status === "active") ?? null;
  const status = tenant.suspended_at ? "suspended" : tenant.archived_at ? "archived" : "active";
  const overrideMap = new Map((detail.overrides as any[]).map((o) => [o.feature?.id, o]));
  const featuresOnly = detail.features.filter((f: any) => !f.is_limit);
  const limitsOnly = detail.features.filter((f: any) => f.is_limit);

  const handleChangePlan = async () => {
    if (!pendingPlanId) return;
    const plan = (detail.plans as any[]).find((p) => p.id === pendingPlanId);
    if (!plan) return;
    try {
      await changeTenantPlan(tenantId, plan.id, plan.code);
      toast.success(t("superadmin.toasts.planChanged"));
      setPlanDialogOpen(false);
      await reload();
    } catch (e: any) {
      toast.error(t("superadmin.toasts.error"), { description: e?.message });
    }
  };

  const handleSuspendToggle = async () => {
    try {
      await setTenantSuspended(tenantId, !tenant.suspended_at);
      toast.success(tenant.suspended_at ? t("superadmin.toasts.reactivated") : t("superadmin.toasts.suspended"));
      setSuspendOpen(false);
      await reload();
    } catch (e: any) {
      toast.error(t("superadmin.toasts.error"), { description: e?.message });
    }
  };

  const handleSaveOverride = async () => {
    if (!ovFeature) return;
    try {
      await upsertFeatureOverride({
        tenantId,
        featureId: ovFeature.id,
        featureKey: ovFeature.key,
        isLimit: !!ovFeature.is_limit,
        enabled: ovFeature.is_limit ? null : ovEnabled === "true",
        limitValue: ovFeature.is_limit ? (ovLimit === "" ? null : Number(ovLimit)) : null,
        reason: ovReason.trim() || null,
      });
      toast.success(t("superadmin.toasts.overrideSaved"));
      setOverrideOpen(false);
      setOvFeatureId(""); setOvLimit(""); setOvReason(""); setOvEnabled("true");
      await reload();
    } catch (e: any) {
      toast.error(t("superadmin.toasts.error"), { description: e?.message });
    }
  };

  const handleRemoveOverride = async (id: string, key: string) => {
    try {
      await deleteFeatureOverride(tenantId, id, key);
      toast.success(t("superadmin.toasts.overrideRemoved"));
      await reload();
    } catch (e: any) {
      toast.error(t("superadmin.toasts.error"), { description: e?.message });
    }
  };

  return (
    <PageBody>
      <div className="mb-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/superadmin/tenants">{t("superadmin.detail.back")}</Link>
        </Button>
      </div>

      <PageHeader
        title={tenant.name}
        description={t("superadmin.detail.title")}
      />

      {/* Identity */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <div className="surface p-5">
          <h2 className="font-serif text-xl mb-3">{t("superadmin.detail.identity")}</h2>
          <dl className="grid grid-cols-[120px,1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t("superadmin.detail.createdAt")}</dt>
            <dd>{new Date(tenant.created_at).toLocaleString()}</dd>
            <dt className="text-muted-foreground">{t("superadmin.detail.owner")}</dt>
            <dd className="truncate">
              {detail.owner ? (detail.owner.full_name || detail.owner.email || "—") : "—"}
              {detail.owner?.email && detail.owner?.full_name ? ` · ${detail.owner.email}` : ""}
            </dd>
            <dt className="text-muted-foreground">{t("superadmin.detail.members")}</dt>
            <dd>{detail.members.length}</dd>
            <dt className="text-muted-foreground">{t("superadmin.detail.status")}</dt>
            <dd>
              <Badge variant={status === "active" ? "outline" : "secondary"}>
                {t(`superadmin.tenants.status.${status}` as const)}
              </Badge>
            </dd>
          </dl>
        </div>

        <div className="surface p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="font-serif text-xl">{t("superadmin.detail.subscription")}</h2>
            <Button size="sm" variant="outline" onClick={() => { setPendingPlanId(activeSub?.plan?.id ?? ""); setPlanDialogOpen(true); }}>
              {t("superadmin.detail.changePlan")}
            </Button>
          </div>
          <dl className="grid grid-cols-[120px,1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t("superadmin.detail.currentPlan")}</dt>
            <dd>{activeSub?.plan?.name ?? "—"} {activeSub?.plan?.code && <span className="text-muted-foreground">({activeSub.plan.code})</span>}</dd>
            <dt className="text-muted-foreground">{t("superadmin.detail.subStatus")}</dt>
            <dd>{activeSub?.status ?? "—"}</dd>
          </dl>
        </div>
      </div>

      {/* Effective features + limits */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <div className="surface p-5">
          <h2 className="font-serif text-xl mb-3">{t("superadmin.detail.features")}</h2>
          <ul className="space-y-1.5 text-sm">
            {featuresOnly.map((f: any) => {
              const enabled = !!snap?.features[f.key];
              const ov = overrideMap.get(f.id);
              return (
                <li key={f.id} className="flex items-start justify-between gap-2 flex-wrap">
                  <span className="min-w-0 break-words">
                    <span className="font-medium">{f.name}</span>{" "}
                    <code className="text-xs text-muted-foreground break-all">{f.key}</code>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {ov && <Badge variant="secondary" className="text-[10px]">override</Badge>}
                    <Badge variant={enabled ? "default" : "outline"}>
                      {enabled ? t("superadmin.detail.overrideEnabled") : t("superadmin.detail.overrideDisabled")}
                    </Badge>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="surface p-5">
          <h2 className="font-serif text-xl mb-3">{t("superadmin.detail.limits")}</h2>
          <ul className="space-y-1.5 text-sm">
            {limitsOnly.map((f: any) => {
              const v = snap?.limits[f.key];
              const ov = overrideMap.get(f.id);
              return (
                <li key={f.id} className="flex items-start justify-between gap-2 flex-wrap">
                  <span className="min-w-0 break-words">
                    <span className="font-medium">{f.name}</span>{" "}
                    <code className="text-xs text-muted-foreground break-all">{f.key}</code>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {ov && <Badge variant="secondary" className="text-[10px]">override</Badge>}
                    <span className="font-medium tabular-nums">{v == null ? t("superadmin.detail.unlimited") : v}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Overrides */}
      <div className="surface p-5 mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="font-serif text-xl">{t("superadmin.detail.overrides")}</h2>
          <Button size="sm" variant="outline" onClick={() => setOverrideOpen(true)}>
            {t("superadmin.detail.addOverride")}
          </Button>
        </div>
        {detail.overrides.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t("superadmin.detail.noOverrides")}</div>
        ) : (
          <ul className="divide-y divide-border">
            {(detail.overrides as any[]).map((o) => (
              <li key={o.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{o.feature?.name} <code className="text-xs text-muted-foreground">{o.feature?.key}</code></div>
                  <div className="text-xs text-muted-foreground">
                    {o.feature?.is_limit
                      ? `${t("superadmin.detail.overrideLimit")}: ${o.limit_value ?? t("superadmin.detail.unlimited")}`
                      : `${o.enabled ? t("superadmin.detail.overrideEnabled") : t("superadmin.detail.overrideDisabled")}`}
                    {o.reason ? ` · ${o.reason}` : ""}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleRemoveOverride(o.id, o.feature?.key)}>
                  {t("superadmin.detail.removeOverride")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent audit */}
      <div className="surface p-5 mb-6">
        <h2 className="font-serif text-xl mb-3">{t("superadmin.detail.recentActivity")}</h2>
        {detail.recentAudit.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t("superadmin.detail.noActivity")}</div>
        ) : (
          <ul className="divide-y divide-border">
            {(detail.recentAudit as any[]).map((r) => (
              <li key={r.id} className="py-2 text-sm flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{r.action}</div>
                  {r.metadata && Object.keys(r.metadata).length > 0 && (
                    <code className="text-[11px] text-muted-foreground break-all">{JSON.stringify(r.metadata)}</code>
                  )}
                </div>
                <div className="text-xs text-muted-foreground shrink-0">{new Date(r.created_at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Danger zone */}
      <div className="surface p-5 border border-destructive/30">
        <h2 className="font-serif text-xl mb-1">{t("superadmin.detail.danger")}</h2>
        <p className="text-sm text-muted-foreground mb-3">
          {tenant.suspended_at ? t("superadmin.detail.confirmReactivate") : t("superadmin.detail.confirmSuspendDesc")}
        </p>
        <Button variant={tenant.suspended_at ? "default" : "destructive"} onClick={() => setSuspendOpen(true)}>
          {tenant.suspended_at ? t("superadmin.detail.reactivate") : t("superadmin.detail.suspend")}
        </Button>
      </div>

      {/* Change plan dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("superadmin.detail.confirmChangePlan")}</DialogTitle>
            <DialogDescription>{t("superadmin.detail.confirmChangePlanDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("superadmin.detail.choosePlan")}</Label>
            <Select value={pendingPlanId} onValueChange={setPendingPlanId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(detail.plans as any[]).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPlanDialogOpen(false)}>{t("superadmin.common.cancel")}</Button>
            <Button onClick={handleChangePlan} disabled={!pendingPlanId}>{t("superadmin.common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend confirm */}
      <AlertDialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tenant.suspended_at ? t("superadmin.detail.confirmReactivate") : t("superadmin.detail.confirmSuspend")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tenant.suspended_at ? "" : t("superadmin.detail.confirmSuspendDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("superadmin.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuspendToggle}>{t("superadmin.common.confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Override dialog */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("superadmin.detail.addOverride")}</DialogTitle>
            <DialogDescription>{t("superadmin.detail.overrideFor")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t("superadmin.plans.features")}</Label>
              <Select value={ovFeatureId} onValueChange={setOvFeatureId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(detail.features as any[]).map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}{f.is_limit ? " · limit" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {ovFeature && !ovFeature.is_limit && (
              <div className="space-y-2">
                <Label>{t("superadmin.detail.overrideEnabled")}</Label>
                <Select value={ovEnabled} onValueChange={(v) => setOvEnabled(v as "true" | "false")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">{t("superadmin.detail.overrideEnabled")}</SelectItem>
                    <SelectItem value="false">{t("superadmin.detail.overrideDisabled")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {ovFeature?.is_limit && (
              <div className="space-y-2">
                <Label>{t("superadmin.detail.overrideLimit")}</Label>
                <Input type="number" value={ovLimit} onChange={(e) => setOvLimit(e.target.value)} />
              </div>
            )}

            <div className="space-y-2">
              <Label>{t("superadmin.detail.overrideReason")}</Label>
              <Input value={ovReason} onChange={(e) => setOvReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOverrideOpen(false)}>{t("superadmin.common.cancel")}</Button>
            <Button onClick={handleSaveOverride} disabled={!ovFeatureId}>{t("superadmin.common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
