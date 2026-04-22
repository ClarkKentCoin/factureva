import { useEffect, useMemo, useState } from "react";
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
import { DocumentsToolbar, Pager, EMPTY_FILTERS, type DocFilters } from "@/components/documents/DocumentsToolbar";

type Row = Awaited<ReturnType<typeof listInvoices>>[number];

const variantFor = (s: InvoiceStatus): "secondary" | "default" | "outline" | "destructive" =>
  s === "draft" ? "secondary"
  : s === "cancelled" ? "outline"
  : s === "overdue" ? "destructive"
  : "default";

const openLabel = (s: InvoiceStatus): string =>
  s === "draft" ? "invoices.openDraft" : "invoices.openIssued";

const PAGE_SIZE = 20;

export default function InvoicesPage() {
  const { t, i18n } = useTranslation();
  const { currentTenantId, user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<DocFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const load = async () => {
    if (!currentTenantId) return;
    setLoading(true);
    try { setRows(await listInvoices(currentTenantId) as Row[]); }
    catch { toast.error(t("common.loadError")); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [currentTenantId]);
  useEffect(() => { setPage(1); }, [filters]);

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

  const statusOptions = useMemo(() => (
    (["draft", "issued", "paid", "overdue", "cancelled"] as InvoiceStatus[])
      .map((s) => ({ value: s, label: t(`invoices.status.${s}`) }))
  ), [t, i18n.language]);

  const clientOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows as any[]) {
      if (r.client?.id && r.client?.display_name) seen.set(r.client.id, r.client.display_name);
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [rows]);

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const soon = new Date(); soon.setDate(soon.getDate() + 3);
    const soonISO = soon.toISOString().slice(0, 10);
    const q = filters.q.trim().toLowerCase();
    const min = filters.amountMin ? Number(filters.amountMin) : null;
    const max = filters.amountMax ? Number(filters.amountMax) : null;

    return (rows as any[]).filter((r) => {
      const total = Number(r.total_ttc);
      const paid = Number(r.paid_amount ?? 0);
      const visible = computeVisibleStatus(r.status as InvoiceStatus, r.due_date, paid, total);

      if (q) {
        const hay = [
          r.invoice_number ?? "",
          r.client?.display_name ?? "",
          r.client?.email ?? "",
          r.client?.phone ?? "",
          String(total),
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.status && r.status !== filters.status) return false;
      if (filters.clientId && r.client?.id !== filters.clientId) return false;
      if (filters.dateFrom && (!r.issue_date || r.issue_date < filters.dateFrom)) return false;
      if (filters.dateTo && (!r.issue_date || r.issue_date > filters.dateTo)) return false;
      if (min !== null && total < min) return false;
      if (max !== null && total > max) return false;
      if (filters.unpaidOnly && !(visible === "issued" || visible === "overdue")) return false;
      if (filters.dueSoon) {
        if (!r.due_date) return false;
        if (r.due_date < today || r.due_date > soonISO) return false;
        if (visible === "paid" || visible === "cancelled") return false;
      }
      return true;
    });
  }, [rows, filters]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
        <>
          <DocumentsToolbar
            filters={filters}
            onChange={setFilters}
            statusOptions={statusOptions}
            clientOptions={clientOptions}
            variant="invoice"
          />
          <div className="surface">
            {pageRows.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">{t("lists.noResults")}</div>
            ) : (
              <div className="divide-y divide-border">
                {pageRows.map((r: any) => {
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
            {filtered.length > PAGE_SIZE && (
              <Pager page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
            )}
          </div>
        </>
      )}
    </PageBody>
  );
}
