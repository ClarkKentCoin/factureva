/**
 * Credit notes list — tenant-scoped read view.
 * Reuses the shared documents engine; credit notes live in the `invoices`
 * table with `document_type = 'credit_note'`.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { FileMinus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PageBody, PageHeader, EmptyState } from "@/components/layout/PageScaffold";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listCreditNotes } from "@/lib/credit-notes";
import { formatMoney } from "@/lib/invoice-totals";
import type { InvoiceStatus } from "@/lib/invoices";

const variantFor = (s: InvoiceStatus): "secondary" | "default" | "outline" =>
  s === "draft" ? "secondary" : s === "cancelled" ? "outline" : "default";

export default function CreditNotesPage() {
  const { t, i18n } = useTranslation();
  const { currentTenantId } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentTenantId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await listCreditNotes(currentTenantId);
        if (alive) setRows(data as any[]);
      } catch {
        toast.error(t("common.loadError"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [currentTenantId, t]);

  const locale = useMemo(
    () => (i18n.language === "fr" ? "fr-FR" : i18n.language === "ru" ? "ru-RU" : "en-GB"),
    [i18n.language],
  );

  return (
    <PageBody>
      <PageHeader
        title={t("creditNotes.title")}
        description={t("creditNotes.description")}
      />

      {loading ? (
        <div className="surface p-6 text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={t("creditNotes.emptyTitle")}
          description={t("creditNotes.emptyDescription")}
          action={
            <Button asChild variant="outline">
              <Link to="/app/invoices">{t("creditNotes.fromInvoiceHint")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="surface">
          <div className="divide-y divide-border">
            {rows.map((r: any) => (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileMinus className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Link to={`/app/credit-notes/${r.id}`} className="font-medium hover:underline">
                      {r.invoice_number ?? t("creditNotes.draftLabel")}
                    </Link>
                    <Badge variant={variantFor(r.status as InvoiceStatus)}>
                      {t(`creditNotes.status.${r.status}`, { defaultValue: r.status })}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5 truncate">
                    {r.client?.display_name ?? "—"}
                    {r.source?.invoice_number && (
                      <> · {t("creditNotes.fields.sourceInvoice")}:{" "}
                        <Link to={`/app/invoices/${r.source.id}`} className="hover:underline font-mono">
                          {r.source.invoice_number}
                        </Link>
                      </>
                    )}
                    {r.issue_date && <> · {new Date(r.issue_date).toLocaleDateString(locale)}</>}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
                  <div className="text-right">
                    <div className="font-mono text-sm">
                      {formatMoney(Number(r.total_ttc), r.currency_code, locale)}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/app/credit-notes/${r.id}`}>
                      {r.status === "draft" ? t("invoices.openDraft") : t("invoices.openIssued")}
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageBody>
  );
}
