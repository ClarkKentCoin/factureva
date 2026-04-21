import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { PageBody, PageHeader, StatCard, EmptyState } from "@/components/layout/PageScaffold";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { FileText, UserPlus, Building2 } from "lucide-react";

export default function Dashboard() {
  const { t } = useTranslation();
  const { memberships, currentTenantId } = useAuth();
  const current = memberships.find((m) => m.tenant_id === currentTenantId);

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
              <Link to="/app/company"><Building2 className="h-4 w-4" />{t("dashboard.completeProfile")}</Link>
            </Button>
          </div>
        </div>
      </div>

      <EmptyState
        title="Démarrez votre activité"
        description="Configurez votre entreprise et créez votre première facture."
        action={<Button asChild><Link to="/app/company">{t("dashboard.completeProfile")}</Link></Button>}
      />
    </PageBody>
  );
}
