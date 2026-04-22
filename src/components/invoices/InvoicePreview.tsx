/**
 * InvoicePreview — V1 structured document preview.
 * Renders a clean, printable document from structured data.
 * Supports both invoice ("facture") and devis (quote) via the `kind` prop:
 * only the document title and date label change — the rest is shared.
 */
import { useTranslation } from "react-i18next";
import { computeInvoiceTotals, formatMoney } from "@/lib/invoice-totals";
import type { EditorInvoice, EditorLine } from "@/lib/invoices";

export type PreviewCompany = {
  logo_url?: string | null;
  signature_url?: string | null;
  company_name?: string | null;
  legal_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  email?: string | null;
  phone?: string | null;
  siren?: string | null;
  siret?: string | null;
  vat_number?: string | null;
  payment_defaults?: { iban?: string; bic?: string; payment_instructions?: string } | null;
};

export type PreviewClient = {
  display_name?: string | null;
  legal_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  email?: string | null;
  vat_number?: string | null;
};

type Props = {
  invoice: EditorInvoice;
  lines: EditorLine[];
  number: string | null;
  status: string;
  company: PreviewCompany | null;
  client: PreviewClient | null;
  legalMentions?: { key: string; reason: string }[];
  /** "invoice" (default), "devis" or "credit_note" — controls title + status namespace + date label. */
  kind?: "invoice" | "devis" | "credit_note";
  /** Optional client-signature image URL — only rendered when kind === "devis". */
  clientSignatureUrl?: string | null;
  /** When kind === "credit_note": reference to the source invoice (number + date). */
  sourceInvoice?: { number: string | null; issue_date: string | null } | null;
  /** Optional correction reason text shown on the credit note PDF/preview. */
  correctionReason?: string | null;
};

export default function InvoicePreview({
  invoice, lines, number, status, company, client, legalMentions = [], kind = "invoice",
  clientSignatureUrl = null, sourceInvoice = null, correctionReason = null,
}: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "fr" ? "fr-FR" : i18n.language === "ru" ? "ru-RU" : "en-GB";
  const totals = computeInvoiceTotals(
    lines.map((l) => ({ quantity: l.quantity, unit_price: l.unit_price, vat_rate: l.vat_rate })),
  );
  const fmt = (n: number) => formatMoney(n, invoice.currency_code, locale);
  const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString(locale) : "—");
  const isDevis = kind === "devis";
  const isCreditNote = kind === "credit_note";

  const companyLines = [
    company?.legal_name && company?.legal_name !== company?.company_name ? company.legal_name : null,
    company?.address_line1,
    company?.address_line2,
    [company?.postal_code, company?.city].filter(Boolean).join(" ") || null,
    company?.email,
    company?.phone,
  ].filter(Boolean) as string[];

  const clientLines = [
    client?.legal_name && client?.legal_name !== client?.display_name ? client.legal_name : null,
    client?.address_line1,
    client?.address_line2,
    [client?.postal_code, client?.city].filter(Boolean).join(" ") || null,
    client?.email,
    client?.vat_number ? `${t("invoices.preview.vatNumberShort")} ${client.vat_number}` : null,
  ].filter(Boolean) as string[];

  const documentTitle = isCreditNote
    ? t("creditNotes.preview.documentTitle")
    : isDevis
    ? t("devis.preview.documentTitle")
    : t("invoices.preview.documentTitle");
  const dueLabel = isCreditNote
    ? null
    : isDevis
    ? t("devis.preview.validUntil")
    : t("invoices.preview.dueDate");
  const statusLabel = isCreditNote
    ? t(`creditNotes.status.${status}`, { defaultValue: status })
    : isDevis
    ? t(`devis.status.${status}`, { defaultValue: status })
    : t(`invoices.status.${status}`, { defaultValue: status });

  return (
    <div className="bg-card text-card-foreground border border-border rounded-md shadow-sm">
      <article className="p-6 sm:p-8 text-[13px] leading-relaxed font-sans">
        {/* Header */}
        <header className="flex items-start justify-between gap-6 pb-6 border-b border-border">
          <div className="min-w-0">
            {company?.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.company_name ?? "logo"}
                className="h-14 w-auto max-w-[180px] object-contain mb-3"
              />
            ) : (
              <div className="h-14 w-32 mb-3 rounded border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground uppercase tracking-wide">
                {t("invoices.preview.logoFallback")}
              </div>
            )}
            <div className="font-semibold text-base">{company?.company_name ?? t("invoices.preview.yourCompany")}</div>
            <div className="text-muted-foreground text-xs whitespace-pre-line">
              {companyLines.join("\n") || t("invoices.preview.noCompanyDetails")}
            </div>
            <div className="text-muted-foreground text-xs mt-1 space-x-2">
              {company?.siren && <span>SIREN {company.siren}</span>}
              {company?.siret && <span>SIRET {company.siret}</span>}
              {company?.vat_number && <span>TVA {company.vat_number}</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-serif text-2xl tracking-tight">{documentTitle}</div>
            <div className="mt-1 font-mono text-sm">{number ?? t("invoices.draftLabel")}</div>
            <div className="mt-3 text-xs text-muted-foreground space-y-0.5">
              <div>
                <span className="uppercase tracking-wide">{t("invoices.preview.issueDate")}</span>{" "}
                <span className="text-foreground">{fmtDate(invoice.issue_date)}</span>
              </div>
              {dueLabel && (
                <div>
                  <span className="uppercase tracking-wide">{dueLabel}</span>{" "}
                  <span className="text-foreground">{fmtDate(invoice.due_date)}</span>
                </div>
              )}
              {isCreditNote && sourceInvoice && (
                <div>
                  <span className="uppercase tracking-wide">{t("creditNotes.preview.sourceInvoice")}</span>{" "}
                  <span className="text-foreground font-mono">
                    {sourceInvoice.number ?? "—"}
                  </span>
                  {sourceInvoice.issue_date && (
                    <> · <span className="text-foreground">{fmtDate(sourceInvoice.issue_date)}</span></>
                  )}
                </div>
              )}
              <div className="uppercase tracking-wide">{statusLabel}</div>
            </div>
          </div>
        </header>

        {/* Bill to */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-6 border-b border-border">
          <div />
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              {t("invoices.preview.billTo")}
            </div>
            {client ? (
              <>
                <div className="font-medium">{client.display_name}</div>
                <div className="text-muted-foreground text-xs whitespace-pre-line">
                  {clientLines.join("\n") || "—"}
                </div>
              </>
            ) : (
              <div className="text-muted-foreground italic">{t("invoices.preview.noClient")}</div>
            )}
          </div>
        </section>

        {/* Lines */}
        <section className="py-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 font-normal w-[48%]">{t("invoices.preview.col.description")}</th>
                <th className="py-2 font-normal text-right">{t("invoices.preview.col.qty")}</th>
                <th className="py-2 font-normal text-right">{t("invoices.preview.col.unitPrice")}</th>
                <th className="py-2 font-normal text-right">{t("invoices.preview.col.vat")}</th>
                <th className="py-2 font-normal text-right">{t("invoices.preview.col.total")}</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">
                  {t("invoices.preview.noLines")}
                </td></tr>
              ) : lines.map((l, i) => {
                const ht = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
                return (
                  <tr key={i} className="align-top border-b border-border/60">
                    <td className="py-2 pr-2">
                      <div className="font-medium">{l.label || "—"}</div>
                      {l.description && (
                        <div className="text-muted-foreground whitespace-pre-line">{l.description}</div>
                      )}
                    </td>
                    <td className="py-2 text-right font-mono whitespace-nowrap">
                      {Number(l.quantity).toLocaleString(locale)} {l.unit ?? ""}
                    </td>
                    <td className="py-2 text-right font-mono whitespace-nowrap">{fmt(Number(l.unit_price))}</td>
                    <td className="py-2 text-right font-mono whitespace-nowrap">{Number(l.vat_rate)}%</td>
                    <td className="py-2 text-right font-mono whitespace-nowrap">{fmt(ht)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Totals */}
        <section className="flex justify-end py-2">
          <div className="w-full sm:w-72 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">{t("invoices.totals.subtotalHT")}</span>
              <span className="font-mono">{fmt(totals.subtotal_ht)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("invoices.totals.totalVat")}</span>
              <span className="font-mono">{fmt(totals.total_vat)}</span></div>
            <div className="flex justify-between text-base font-semibold pt-2 border-t border-border mt-1">
              <span>{t("invoices.totals.totalTTC")}</span>
              <span className="font-mono">{fmt(totals.total_ttc)}</span>
            </div>
          </div>
        </section>

        {/* Notes */}
        {invoice.notes && (
          <section className="pt-4 border-t border-border mt-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              {t("invoices.sections.notes")}
            </div>
            <div className="whitespace-pre-line text-xs">{invoice.notes}</div>
          </section>
        )}

        {/* Payment (invoices only — not relevant for quotes) */}
        {!isDevis && (company?.payment_defaults?.iban || company?.payment_defaults?.payment_instructions) && (
          <section className="pt-4 border-t border-border mt-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              {t("invoices.preview.paymentTitle")}
            </div>
            <div className="text-xs space-y-0.5">
              {company.payment_defaults?.iban && <div>IBAN : <span className="font-mono">{company.payment_defaults.iban}</span></div>}
              {company.payment_defaults?.bic && <div>BIC : <span className="font-mono">{company.payment_defaults.bic}</span></div>}
              {company.payment_defaults?.payment_instructions && (
                <div className="whitespace-pre-line text-muted-foreground">{company.payment_defaults.payment_instructions}</div>
              )}
            </div>
          </section>
        )}

        {/* Devis-specific footer + signature blocks */}
        {isDevis && (
          <>
            <section className="pt-4 border-t border-border mt-4">
              <div className="text-[11px] text-muted-foreground italic">
                {t("devis.preview.acceptanceNote")}
              </div>
            </section>
            <section className="pt-6 mt-2 grid grid-cols-2 gap-6">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                  {t("devis.preview.companySignature")}
                </div>
                <div className="h-20 border-b border-border flex items-end">
                  {company?.signature_url ? (
                    <img
                      src={company.signature_url}
                      alt="company signature"
                      className="max-h-20 max-w-full object-contain"
                    />
                  ) : null}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {company?.company_name ?? ""}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                  {t("devis.preview.clientSignature")}
                </div>
                <div className="h-20 border-b border-border flex items-end">
                  {clientSignatureUrl ? (
                    <img
                      src={clientSignatureUrl}
                      alt="client signature"
                      className="max-h-20 max-w-full object-contain"
                    />
                  ) : null}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {client?.display_name ?? ""}
                </div>
              </div>
            </section>
          </>
        )}

        {/* Legal mentions */}
        {legalMentions.length > 0 && (
          <section className="pt-4 border-t border-border mt-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              {t("invoices.preview.legalMentions")}
            </div>
            <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc pl-4">
              {legalMentions.map((m) => <li key={m.key}>{m.reason}</li>)}
            </ul>
          </section>
        )}
      </article>
    </div>
  );
}
