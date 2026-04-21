import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { PageBody, PageHeader, StatCard, EmptyState } from "@/components/layout/PageScaffold";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { FileText, UserPlus, Building2, CheckCircle2 } from "lucide-react";
import { loadPrimaryCompany } from "@/lib/company-profile";

export default function Dashboard() {
  const { t } = useTranslation();
  const { memberships, currentTenantId } = useAuth();
  const current = memberships.find((m) => m.tenant_id === currentTenantId);
  const [hasCompany, setHasCompany] = useState<boolean | null>(null);

  useEffect(() => {
    if (!currentTenantId) return;
    let alive = true;
    loadPrimaryCompany(currentTenantId)
      .then((row) => alive && setHasCompany(!!row))
      .catch(() => alive && setHasCompany(false));
    return () => { alive = false; };
  }, [currentTenantId]);

  return (
    <PageBody>
      <PageHeader
        title={`${t("dashboard.welcome")}${current ? ` — ${current.tenant.name}` : ""}`}
        description={t("app.tagline")}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label={t("dashboard.revenue")} value="0,00 €" hint="—" />
        <StatCard label={t("dashboard.unpaid")} value="0" hint="—" />
        <StatCard label={t("dashboard.clients")} value="0" hint="—" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="surface p-5 lg:col-span-2">
          <h2 className="font-serif text-xl mb-3">{t("dashboard.recentActivity")}</h2>
          <p className="text-sm text-muted-foreground">{t("dashboard.empty")}</p>
        </div>
        <div className="surface p-5">
          <h2 className="font-serif text-xl mb-3">{t("dashboard.quickActions")}</h2>
          <div className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link to="/app/invoices"><FileText className="h-4 w-4" />{t("dashboard.newInvoice")}</Link>
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
