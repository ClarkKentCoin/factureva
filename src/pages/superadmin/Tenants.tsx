import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageBody, PageHeader, EmptyState } from "@/components/layout/PageScaffold";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { listTenantsForAdmin, type TenantListItem } from "@/lib/superadmin";

type StatusFilter = "all" | "active" | "suspended" | "archived";

export default function SuperAdminTenants() {
  const { t } = useTranslation();
  const [tenants, setTenants] = useState<TenantListItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    listTenantsForAdmin().then(setTenants).catch(() => setTenants([]));
  }, []);

  const planOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const tn of tenants ?? []) if (tn.planCode) set.set(tn.planCode, tn.planName ?? tn.planCode);
    return Array.from(set.entries());
  }, [tenants]);

  const filtered = useMemo(() => {
    if (!tenants) return [];
    const q = search.trim().toLowerCase();
    return tenants.filter((tn) => {
      if (planFilter !== "all" && (tn.planCode ?? "") !== planFilter) return false;
      const status: StatusFilter = tn.suspended_at ? "suspended" : tn.archived_at ? "archived" : "active";
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!q) return true;
      return (
        tn.name.toLowerCase().includes(q) ||
        (tn.ownerEmail ?? "").toLowerCase().includes(q) ||
        (tn.ownerName ?? "").toLowerCase().includes(q)
      );
    });
  }, [tenants, search, planFilter, statusFilter]);

  return (
    <PageBody>
      <PageHeader title={t("superadmin.tenants.title")} description={t("superadmin.tenants.description")} />

      <div className="grid gap-2 sm:grid-cols-[1fr,180px,180px] mb-4">
        <Input
          placeholder={t("superadmin.tenants.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger><SelectValue placeholder={t("superadmin.tenants.filterPlan")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("superadmin.tenants.allPlans")}</SelectItem>
            {planOptions.map(([code, name]) => (
              <SelectItem key={code} value={code}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger><SelectValue placeholder={t("superadmin.tenants.filterStatus")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("superadmin.tenants.allStatuses")}</SelectItem>
            <SelectItem value="active">{t("superadmin.tenants.status.active")}</SelectItem>
            <SelectItem value="suspended">{t("superadmin.tenants.status.suspended")}</SelectItem>
            <SelectItem value="archived">{t("superadmin.tenants.status.archived")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!tenants ? (
        <div className="text-sm text-muted-foreground">{t("superadmin.common.loading")}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t("superadmin.tenants.emptyTitle")}
          description={t("superadmin.tenants.emptyDescription")}
        />
      ) : (
        <div className="surface divide-y divide-border">
          {filtered.map((tn) => {
            const status: StatusFilter = tn.suspended_at ? "suspended" : tn.archived_at ? "archived" : "active";
            return (
              <div key={tn.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/superadmin/tenants/${tn.id}`} className="font-medium hover:underline truncate">
                      {tn.name}
                    </Link>
                    {status !== "active" && (
                      <Badge variant="secondary">{t(`superadmin.tenants.status.${status}` as const)}</Badge>
                    )}
                    {tn.planName && <Badge variant="outline">{tn.planName}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {tn.ownerName || tn.ownerEmail || "—"}
                    {tn.ownerEmail && tn.ownerName ? ` · ${tn.ownerEmail}` : ""}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground md:justify-end">
                  <Stat label={t("superadmin.tenants.members")} value={tn.members} />
                  <Stat label={t("superadmin.tenants.clients")} value={tn.clients} />
                  <Stat label={t("superadmin.tenants.invoices")} value={tn.invoices} />
                  <Stat label={t("superadmin.tenants.devis")} value={tn.devis} />
                  <Stat label={t("superadmin.tenants.createdAt")} value={new Date(tn.created_at).toLocaleDateString()} />
                </div>

                <Button asChild size="sm" variant="outline">
                  <Link to={`/superadmin/tenants/${tn.id}`}>{t("superadmin.tenants.open")}</Link>
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </PageBody>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-foreground text-sm font-medium">{value}</div>
    </div>
  );
}
