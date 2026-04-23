import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { PageBody, PageHeader, StatCard, EmptyState } from "@/components/layout/PageScaffold";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { FileText, FileSignature, UserPlus, Building2, CheckCircle2 } from "lucide-react";
import { loadPrimaryCompany } from "@/lib/company-profile";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/invoice-totals";
import { computeVisibleStatus, balanceDue } from "@/lib/payments";
import type { Database } from "@/integrations/supabase/types";

type InvoiceLite = {
  id: string;
  invoice_number: string | null;
  status: Database["public"]["Enums"]["invoice_status"];
  issue_date: string | null;
  due_date: string | null;
  total_ttc: number;
  paid_amount: number | null;
  currency_code: string;
  created_at: string;
  client: { display_name: string } | null;
};

type Metrics = {
  invoicedThisMonth: number;
  paidThisMonth: number;
  unpaidAmount: number;
  overdueAmount: number;
  overdueCount: number;
  currency: string;
};

const monthBounds = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { startISO: start.toISOString().slice(0, 10), endISO: end.toISOString().slice(0, 10) };
};

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { memberships, currentTenantId } = useAuth();
  const current = memberships.find((m) => m.tenant_id === currentTenantId);
  const [hasCompany, setHasCompany] = useState<boolean | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recent, setRecent] = useState<InvoiceLite[]>([]);

  const locale = i18n.language === "fr" ? "fr-FR" : i18n.language === "ru" ? "ru-RU" : "en-GB";

  useEffect(() => {
    if (!currentTenantId) return;
    let alive = true;

    loadPrimaryCompany(currentTenantId)
      .then((row) => alive && setHasCompany(!!row))
      .catch(() => alive && setHasCompany(false));

    (async () => {
      const { startISO, endISO } = monthBounds();
      const [allRes, recentRes] = await Promise.all([
        supabase.from("invoices")
          .select("id, status, issue_date, due_date, total_ttc, paid_amount, currency_code")
          .eq("tenant_id", currentTenantId),
        supabase.from("invoices")
          .select("id, invoice_number, status, issue_date, due_date, total_ttc, paid_amount, currency_code, created_at, client:clients(display_name)")
          .eq("tenant_id", currentTenantId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      if (!alive) return;

      const all = (allRes.data ?? []) as Array<{
        status: Database["public"]["Enums"]["invoice_status"];
        issue_date: string | null;
        due_date: string | null;
        total_ttc: number;
        paid_amount: number | null;
        currency_code: string;
      }>;

      let invoicedThisMonth = 0, paidThisMonth = 0, unpaidAmount = 0, overdueAmount = 0, overdueCount = 0;
      let currency = "EUR";
      for (const r of all) {
        currency = r.currency_code || currency;
        if (r.status === "cancelled" || r.status === "draft") continue;
        const total = Number(r.total_ttc);
        const paid = Number(r.paid_amount ?? 0);
        const due = balanceDue(total, paid);
        if (r.issue_date && r.issue_date >= startISO && r.issue_date < endISO) {
          invoicedThisMonth += total;
          paidThisMonth += paid;
        }
        const v = computeVisibleStatus(r.status, r.due_date, paid, total);
        if (v === "issued" || v === "overdue") unpaidAmount += due;
        if (v === "overdue") { overdueAmount += due; overdueCount += 1; }
      }
      setMetrics({ invoicedThisMonth, paidThisMonth, unpaidAmount, overdueAmount, overdueCount, currency });
      setRecent((recentRes.data ?? []) as InvoiceLite[]);
    })();

    return () => { alive = false; };
  }, [currentTenantId]);

  return (
    <PageBody>
      <PageHeader
        title={`${t("dashboard.welcome")}${current ? ` — ${current.tenant.name}` : ""}`}
        description={t("dashboard.subtitle")}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label={t("dashboard.invoicedThisMonth")}
          value={metrics ? formatMoney(metrics.invoicedThisMonth, metrics.currency, locale) : "—"}
          hint={t("dashboard.thisMonth")}
        />
        <StatCard
          label={t("dashboard.paidThisMonth")}
          value={metrics ? formatMoney(metrics.paidThisMonth, metrics.currency, locale) : "—"}
          hint={t("dashboard.thisMonth")}
        />
        <StatCard
          label={t("dashboard.unpaid")}
          value={metrics ? formatMoney(metrics.unpaidAmount, metrics.currency, locale) : "—"}
          hint={t("dashboard.allTime")}
        />
        <StatCard
          label={t("dashboard.overdue")}
          value={metrics ? formatMoney(metrics.overdueAmount, metrics.currency, locale) : "—"}
          hint={metrics ? t("dashboard.overdueCount", { count: metrics.overdueCount }) : "—"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="surface p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-xl">{t("dashboard.recentInvoices")}</h2>
            <Button asChild variant="ghost" size="sm"><Link to="/app/invoices">{t("dashboard.viewAll")}</Link></Button>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dashboard.empty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((r) => {
                const total = Number(r.total_ttc);
                const paid = Number(r.paid_amount ?? 0);
                const visible = computeVisibleStatus(r.status, r.due_date, paid, total);
                return (
                  <li key={r.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/app/invoices/${r.id}`} className="text-sm font-medium hover:underline">
                        {r.invoice_number ?? t("invoices.draftLabel")}
                      </Link>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.client?.display_name ?? t("invoices.noClient")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={
                        visible === "paid" ? "default"
                        : visible === "overdue" ? "destructive"
                        : visible === "draft" ? "secondary"
                        : visible === "cancelled" ? "outline"
                        : "default"
                      }>{t(`invoices.status.${visible}`)}</Badge>
                      <span className="font-mono text-sm">{formatMoney(total, r.currency_code, locale)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="surface p-5">
          <h2 className="font-serif text-xl mb-3">{t("dashboard.quickActions")}</h2>
          <div className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link to="/app/invoices/new"><FileText className="h-4 w-4" />{t("dashboard.newInvoice")}</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link to="/app/devis/new"><FileSignature className="h-4 w-4" />{t("dashboard.newDevis")}</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link to="/app/clients"><UserPlus className="h-4 w-4" />{t("dashboard.newClient")}</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link to="/app/company">
                {hasCompany ? <CheckCircle2 className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                {t("dashboard.completeProfile")}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {hasCompany === false && (
        <EmptyState
          title={t("dashboard.getStartedTitle")}
          description={t("dashboard.getStartedDescription")}
          action={<Button asChild><Link to="/app/company">{t("dashboard.completeProfile")}</Link></Button>}
        />
      )}
    </PageBody>
  );
}
