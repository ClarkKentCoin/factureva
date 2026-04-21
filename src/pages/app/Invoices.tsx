import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, FileText, Copy, Ban } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PageBody, PageHeader, EmptyState } from "@/components/layout/PageScaffold";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listInvoices, cancelInvoice, duplicateInvoice, type InvoiceStatus } from "@/lib/invoices";
import { formatMoney } from "@/lib/invoice-totals";
import { computeVisibleStatus, balanceDue } from "@/lib/payments";

type Row = Awaited<ReturnType<typeof listInvoices>>[number];

const variantFor = (s: InvoiceStatus): "secondary" | "default" | "outline" | "destructive" =>
  s === "draft" ? "secondary"
  : s === "cancelled" ? "outline"
  : s === "overdue" ? "destructive"
  : "default";

const openLabel = (s: InvoiceStatus): string =>
  s === "draft" ? "invoices.openDraft" : "invoices.openIssued";

export default function InvoicesPage() {
  const { t, i18n } = useTranslation();
  const { currentTenantId, user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!currentTenantId) return;
    setLoading(true);
    try { setRows(await listInvoices(currentTenantId) as Row[]); }
    catch { toast.error(t("common.loadError")); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [currentTenantId]);

  const onDuplicate = async (id: string) => {
    if (!currentTenantId) return;
    try {
      const newId = await duplicateInvoice(currentTenantId, user?.id ?? null, id);
      toast.success(t("invoices.toasts.duplicated"));
      navigate(`/app/invoices/${newId}`);
    } catch { toast.error(t("common.saveError")); }
  };

  const onCancel = async (id: string) => {
    try { await cancelInvoice(id); toast.success(t("invoices.toasts.cancelled")); void load(); }
    catch { toast.error(t("common.saveError")); }
  };

  const locale = i18n.language === "fr" ? "fr-FR" : i18n.language === "ru" ? "ru-RU" : "en-GB";

  return (
    <PageBody>
      <PageHeader
        title={t("invoices.title")}
        description={t("invoices.description")}
        actions={
          <Button asChild className="gap-2">
            <Link to="/app/invoices/new"><Plus className="h-4 w-4" />{t("invoices.new")}</Link>
          </Button>
        }
      />

      {loading ? (
        <div className="surface p-6 text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={t("invoices.emptyTitle")}
          description={t("invoices.emptyDescription")}
          action={<Button asChild><Link to="/app/invoices/new">{t("invoices.new")}</Link></Button>}
        />
      ) : (
        <div className="surface divide-y divide-border">
          {rows.map((r: any) => {
            const total = Number(r.total_ttc);
            const paid = Number(r.paid_amount ?? 0);
            const due = balanceDue(total, paid);
            const visible = computeVisibleStatus(r.status as InvoiceStatus, r.due_date, paid, total);
            return (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Link to={`/app/invoices/${r.id}`} className="font-medium hover:underline">
                      {r.invoice_number ?? t("invoices.draftLabel")}
                    </Link>
                    <Badge variant={variantFor(visible)}>
                      {t(`invoices.status.${visible}`)}
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
                    {(visible === "issued" || visible === "overdue" || visible === "paid") && (
                      <div className="text-xs text-muted-foreground font-mono">
                        {visible === "paid"
                          ? t("invoices.payments.paidLabel")
                          : `${t("invoices.payments.dueLabel")}: ${formatMoney(due, r.currency_code, locale)}`}
                      </div>
                    )}
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/app/invoices/${r.id}`}>{t(openLabel(r.status as InvoiceStatus))}</Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDuplicate(r.id)} className="gap-1">
                    <Copy className="h-4 w-4" />{t("invoices.duplicate")}
                  </Button>
                  {r.status === "draft" && (
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
