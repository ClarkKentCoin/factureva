import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, FileText, Copy, Ban, ArrowRightLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PageBody, PageHeader, EmptyState } from "@/components/layout/PageScaffold";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  listDevis, duplicateInvoice, setDevisStatus, convertDevisToInvoice,
  type InvoiceStatus,
} from "@/lib/invoices";
import { formatMoney } from "@/lib/invoice-totals";

type Row = Awaited<ReturnType<typeof listDevis>>[number];

const variantFor = (s: InvoiceStatus): "secondary" | "default" | "outline" | "destructive" =>
  s === "draft" ? "secondary"
  : s === "cancelled" || s === "expired" ? "outline"
  : s === "rejected" ? "destructive"
  : "default";

export default function DevisPage() {
  const { t, i18n } = useTranslation();
  const { currentTenantId, user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!currentTenantId) return;
    setLoading(true);
    try { setRows(await listDevis(currentTenantId) as Row[]); }
    catch { toast.error(t("common.loadError")); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [currentTenantId]);

  const onDuplicate = async (id: string) => {
    if (!currentTenantId) return;
    try {
      const newId = await duplicateInvoice(currentTenantId, user?.id ?? null, id);
      toast.success(t("devis.toasts.duplicated"));
      navigate(`/app/devis/${newId}`);
    } catch { toast.error(t("common.saveError")); }
  };

  const onCancel = async (id: string) => {
    try { await setDevisStatus(id, "cancelled"); toast.success(t("devis.toasts.cancelled")); void load(); }
    catch { toast.error(t("common.saveError")); }
  };

  const onConvert = async (id: string) => {
    if (!currentTenantId) return;
    try {
      const newInvId = await convertDevisToInvoice(currentTenantId, user?.id ?? null, id);
      toast.success(t("devis.toasts.converted"));
      navigate(`/app/invoices/${newInvId}`);
    } catch { toast.error(t("common.saveError")); }
  };

  const locale = i18n.language === "fr" ? "fr-FR" : i18n.language === "ru" ? "ru-RU" : "en-GB";

  return (
    <PageBody>
      <PageHeader
        title={t("devis.title")}
        description={t("devis.description")}
        actions={
          <Button asChild className="gap-2">
            <Link to="/app/devis/new"><Plus className="h-4 w-4" />{t("devis.new")}</Link>
          </Button>
        }
      />

      {loading ? (
        <div className="surface p-6 text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={t("devis.emptyTitle")}
          description={t("devis.emptyDescription")}
          action={<Button asChild><Link to="/app/devis/new">{t("devis.new")}</Link></Button>}
        />
      ) : (
        <div className="surface divide-y divide-border">
          {rows.map((r: any) => {
            const total = Number(r.total_ttc);
            const s = r.status as InvoiceStatus;
            return (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Link to={`/app/devis/${r.id}`} className="font-medium hover:underline">
                      {r.invoice_number ?? t("devis.draftLabel")}
                    </Link>
                    <Badge variant={variantFor(s)}>
                      {t(`devis.status.${s}`, { defaultValue: s })}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5 truncate">
                    {r.client?.display_name ?? t("invoices.noClient")}
                    {r.issue_date && <> · {new Date(r.issue_date).toLocaleDateString(locale)}</>}
                    {r.last_sent_at && (
                      <> · <span className="text-foreground/70">{t("invoices.email.sentBadge")}</span></>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
                  <div className="text-right">
                    <div className="font-mono text-sm">
                      {formatMoney(total, r.currency_code, locale)}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/app/devis/${r.id}`}>
                      {s === "draft" ? t("invoices.openDraft") : t("invoices.openIssued")}
                    </Link>
                  </Button>
                  {(s === "accepted" || s === "sent") && (
                    <Button size="sm" variant="ghost" onClick={() => onConvert(r.id)} className="gap-1">
                      <ArrowRightLeft className="h-4 w-4" />{t("devis.actions.convert")}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => onDuplicate(r.id)} className="gap-1">
                    <Copy className="h-4 w-4" />{t("invoices.duplicate")}
                  </Button>
                  {s === "draft" && (
                    <Button size="sm" variant="ghost" onClick={() => onCancel(r.id)} className="gap-1">
                      <Ban className="h-4 w-4" />{t("invoices.cancel")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageBody>
  );
}
