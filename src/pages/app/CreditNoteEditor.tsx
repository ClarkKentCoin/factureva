/**
 * CreditNoteEditor — structured editor for avoirs / credit notes.
 *
 * Always linked to a source invoice. The source invoice is fixed and locked:
 *   - client is locked from source
 *   - currency is locked from source
 *   - source_invoice_id is required
 *
 * Two flows:
 *   - full credit: pre-fill all source invoice lines (?invoice=:id&mode=full)
 *   - partial credit: start with one empty line (?invoice=:id&mode=partial)
 *
 * V1 statuses: draft → issued; or cancelled. Once issued the document is
 * read-only. The DB enforces that cumulative issued credits cannot exceed
 * the source invoice total (`credit_note_exceeds_source_total`).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, Send, Save, Eye, Download, Ban, Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useEntitlements } from "@/hooks/use-entitlements";
import { UpgradeDialog } from "@/components/billing/UpgradeDialog";
import { PageBody, PageHeader } from "@/components/layout/PageScaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  loadInvoiceWithLines, newEmptyLine,
  type EditorLine, type InvoiceRow, type InvoiceStatus,
} from "@/lib/invoices";
import {
  buildEditorFromSource, emptyEditorFromSource, saveCreditNoteDraft, issueCreditNote, cancelCreditNote,
  sumIssuedCreditsForInvoice, creditableAmount,
  type CreditNoteEditor,
} from "@/lib/credit-notes";
import { computeInvoiceTotals, formatMoney } from "@/lib/invoice-totals";
import { loadPrimaryCompany, type CompanyRow } from "@/lib/company-profile";
import InvoicePreview, { type PreviewClient, type PreviewCompany } from "@/components/invoices/InvoicePreview";
import { renderInvoicePdf, downloadBlob } from "@/lib/invoice-pdf";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function CreditNoteEditorPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentTenantId, user } = useAuth();
  const { hasFeature, loading: entLoading } = useEntitlements();
  const canCreate = hasFeature("credit_notes.create");

  const isNew = !id || id === "new";
  const sourceInvoiceParam = searchParams.get("invoice");
  const modeParam = (searchParams.get("mode") ?? "full") as "full" | "partial";

  const [gateOpen, setGateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [status, setStatus] = useState<InvoiceStatus>("draft");
  const [number, setNumber] = useState<string | null>(null);
  const [creditNote, setCreditNote] = useState<CreditNoteEditor>({
    client_id: null,
    issue_date: todayISO(),
    due_date: null,
    currency_code: "EUR",
    document_language: "fr",
    notes: null,
    source_invoice_id: "",
    correction_reason: null,
  });
  const [lines, setLines] = useState<EditorLine[]>([]);
  const [source, setSource] = useState<InvoiceRow | null>(null);
  const [creditedSoFar, setCreditedSoFar] = useState(0);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [legalMentions, setLegalMentions] = useState<{ key: string; reason: string }[]>([]);
  const [snapshotSeller, setSnapshotSeller] = useState<PreviewCompany | null>(null);
  const [snapshotClient, setSnapshotClient] = useState<PreviewClient | null>(null);
  const [clientFull, setClientFull] = useState<PreviewClient | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const offscreenRef = useRef<HTMLDivElement | null>(null);

  // Block creating a NEW credit note when feature not granted
  useEffect(() => {
    if (isNew && !entLoading && !canCreate) setGateOpen(true);
  }, [isNew, entLoading, canCreate]);

  useEffect(() => {
    if (!currentTenantId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const comp = await loadPrimaryCompany(currentTenantId);
        if (!alive) return;
        setCompany(comp);
        const lr = (comp?.legal_requirements ?? {}) as { legal_mentions?: { key: string; reason: string }[] };
        setLegalMentions(lr.legal_mentions ?? []);

        if (!isNew && id) {
          // Load existing credit note
          const { invoice: cn, lines: ls } = await loadInvoiceWithLines(id);
          if (!alive) return;
          if (cn.document_type !== "credit_note") {
            toast.error(t("creditNotes.errors.notACreditNote"));
            navigate("/app/credit-notes", { replace: true });
            return;
          }
          setStatus(cn.status);
          setNumber(cn.invoice_number);
          setCreditNote({
            id: cn.id,
            client_id: cn.client_id,
            issue_date: cn.issue_date,
            due_date: null,
            currency_code: cn.currency_code,
            document_language: cn.document_language,
            notes: cn.notes ?? null,
            source_invoice_id: cn.source_invoice_id ?? "",
            correction_reason: cn.correction_reason ?? null,
          });
          setLines(ls.length ? ls.map((l, i) => ({
            id: l.id, sort_order: i,
            item_id: l.item_id, activity_id: l.activity_id, item_type: l.item_type,
            label: l.label, description: l.description,
            quantity: Number(l.quantity), unit: l.unit,
            unit_price: Number(l.unit_price), vat_rate: Number(l.vat_rate),
          })) : [newEmptyLine(0)]);

          if (cn.source_invoice_id) {
            const { data: src } = await supabase
              .from("invoices").select("*").eq("id", cn.source_invoice_id).maybeSingle();
            if (alive && src) {
              setSource(src as InvoiceRow);
              const sum = await sumIssuedCreditsForInvoice(cn.source_invoice_id);
              if (alive) setCreditedSoFar(sum);
            }
          }
          if (cn.status !== "draft") {
            setSnapshotSeller((cn.seller_snapshot ?? null) as PreviewCompany | null);
            setSnapshotClient((cn.client_snapshot ?? null) as PreviewClient | null);
            const snap = (cn.legal_requirements_snapshot ?? {}) as { legal_mentions?: { key: string; reason: string }[] };
            if (snap.legal_mentions) setLegalMentions(snap.legal_mentions);
          }
        } else {
          // NEW credit note: requires source invoice
          if (!sourceInvoiceParam) {
            toast.error(t("creditNotes.errors.sourceRequired"));
            navigate("/app/invoices", { replace: true });
            return;
          }
          if (modeParam === "partial") {
            const { data: src } = await supabase
              .from("invoices").select("*").eq("id", sourceInvoiceParam).maybeSingle();
            if (!alive) return;
            if (!src || (src as any).document_type !== "invoice") {
              toast.error(t("creditNotes.errors.sourceMustBeInvoice"));
              navigate("/app/invoices", { replace: true });
              return;
            }
            const { invoice: editorInv, lines: editorLines } = emptyEditorFromSource(src as InvoiceRow);
            setSource(src as InvoiceRow);
            setCreditNote(editorInv);
            setLines(editorLines);
            const sum = await sumIssuedCreditsForInvoice((src as InvoiceRow).id);
            if (alive) setCreditedSoFar(sum);
          } else {
            const { source: src, invoice: editorInv, lines: editorLines } =
              await buildEditorFromSource(sourceInvoiceParam);
            if (!alive) return;
            setSource(src);
            setCreditNote(editorInv);
            setLines(editorLines);
            const sum = await sumIssuedCreditsForInvoice(src.id);
            if (alive) setCreditedSoFar(sum);
          }
        }
      } catch (e: any) {
        if (e?.message === "credit_note_source_must_be_invoice") {
          toast.error(t("creditNotes.errors.sourceMustBeInvoice"));
          navigate("/app/invoices", { replace: true });
        } else {
          toast.error(t("common.loadError"));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [currentTenantId, id, isNew, sourceInvoiceParam, modeParam, navigate, t]);

  // Fetch full client (for live preview during draft state).
  useEffect(() => {
    if (status !== "draft") return;
    if (!creditNote.client_id) { setClientFull(null); return; }
    let alive = true;
    supabase.from("clients").select("*").eq("id", creditNote.client_id).maybeSingle()
      .then(({ data }) => { if (alive) setClientFull(data as PreviewClient | null); });
    return () => { alive = false; };
  }, [creditNote.client_id, status]);

  const totals = useMemo(
    () => computeInvoiceTotals(lines.map((l) => ({
      quantity: l.quantity, unit_price: l.unit_price, vat_rate: l.vat_rate,
    }))),
    [lines],
  );

  const locale = i18n.language === "fr" ? "fr-FR" : i18n.language === "ru" ? "ru-RU" : "en-GB";
  const readonly = status !== "draft";
  const sourceTotal = Number(source?.total_ttc ?? 0);
  // Remaining creditable EXCLUDES this draft (not yet issued).
  const remainingCreditable = creditableAmount(sourceTotal, creditedSoFar);
  const exceedsCap = totals.total_ttc > remainingCreditable + 0.005;

  const previewCompany: PreviewCompany | null = readonly ? snapshotSeller : (company ? {
    logo_url: company.logo_url,
    company_name: company.company_name,
    legal_name: company.legal_name,
    address_line1: company.address_line1, address_line2: company.address_line2,
    postal_code: company.postal_code, city: company.city,
    email: company.email, phone: company.phone,
    siren: company.siren, siret: company.siret, vat_number: company.vat_number,
    payment_defaults: company.payment_defaults as PreviewCompany["payment_defaults"],
  } : null);
  const previewClient: PreviewClient | null = readonly ? snapshotClient : clientFull;

  const updateLine = (idx: number, patch: Partial<EditorLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };
  const addLine = () => setLines((p) => [...p, newEmptyLine(p.length)]);
  const removeLine = (idx: number) =>
    setLines((p) => p.filter((_, i) => i !== idx).map((l, i) => ({ ...l, sort_order: i })));
  const moveLine = (idx: number, dir: -1 | 1) => {
    setLines((p) => {
      const arr = [...p]; const j = idx + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return arr.map((l, i) => ({ ...l, sort_order: i }));
    });
  };

  const onSave = async () => {
    if (!currentTenantId) return;
    setSaving(true);
    try {
      const newId = await saveCreditNoteDraft(currentTenantId, user?.id ?? null, creditNote, lines);
      toast.success(t("creditNotes.toasts.saved"));
      if (isNew) navigate(`/app/credit-notes/${newId}`, { replace: true });
      else setCreditNote((p) => ({ ...p, id: newId }));
    } catch (e: any) { toast.error(e?.message || t("common.saveError")); }
    finally { setSaving(false); }
  };

  const onIssue = async () => {
    if (!currentTenantId) return;
    if (!creditNote.source_invoice_id) {
      toast.error(t("creditNotes.errors.sourceRequired")); return;
    }
    if (lines.length === 0 || lines.some((l) => !l.label.trim())) {
      toast.error(t("invoices.errors.linesRequired")); return;
    }
    if (exceedsCap) {
      toast.error(t("creditNotes.errors.exceedsSourceTotal", {
        max: formatMoney(remainingCreditable, creditNote.currency_code, locale),
      }));
      return;
    }
    setIssuing(true);
    try {
      const newId = await saveCreditNoteDraft(currentTenantId, user?.id ?? null, creditNote, lines);
      const num = await issueCreditNote(currentTenantId, newId);
      toast.success(t("creditNotes.toasts.issued", { number: num }));
      navigate(`/app/credit-notes/${newId}`, { replace: true });
      setTimeout(() => window.location.reload(), 50);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("credit_note_exceeds_source_total")) {
        toast.error(t("creditNotes.errors.exceedsSourceTotal", {
          max: formatMoney(remainingCreditable, creditNote.currency_code, locale),
        }));
      } else if (msg.includes("credit_note_source_must_be_invoice")) {
        toast.error(t("creditNotes.errors.sourceMustBeInvoice"));
      } else {
        toast.error(msg || t("common.saveError"));
      }
    } finally { setIssuing(false); }
  };

  const onCancelCreditNote = async () => {
    if (!creditNote.id) return;
    try {
      await cancelCreditNote(creditNote.id);
      toast.success(t("creditNotes.toasts.cancelled"));
      setStatus("cancelled");
    } catch { toast.error(t("common.saveError")); }
  };

  const pdfFilename = () => {
    const base = number ?? `draft-${creditNote.id ?? "new"}`;
    return `${base}.pdf`.replace(/[^a-zA-Z0-9._-]/g, "_");
  };
  const renderForCapture = async () => {
    const node = offscreenRef.current ?? previewRef.current;
    if (!node) throw new Error("preview_not_ready");
    return renderInvoicePdf(node, pdfFilename());
  };
  const onDownloadPdf = async () => {
    setDownloading(true);
    try {
      const { blob, filename } = await renderForCapture();
      downloadBlob(blob, filename);
      toast.success(t("invoices.pdf.toasts.downloaded"));
    } catch { toast.error(t("invoices.pdf.errors.generateFailed")); }
    finally { setDownloading(false); }
  };

  if (loading) {
    return (
      <PageBody>
        <div className="surface p-6 text-sm text-muted-foreground">{t("common.loading")}</div>
      </PageBody>
    );
  }

  // Adapter to feed InvoicePreview which expects EditorInvoice shape.
  const previewInvoice = {
    client_id: creditNote.client_id,
    issue_date: creditNote.issue_date,
    due_date: null,
    currency_code: creditNote.currency_code,
    document_language: creditNote.document_language,
    notes: creditNote.notes,
  };

  const previewNode = (
    <InvoicePreview
      invoice={previewInvoice}
      lines={lines}
      number={number}
      status={status}
      company={previewCompany}
      client={previewClient}
      legalMentions={legalMentions}
      kind="credit_note"
      sourceInvoice={source ? { number: source.invoice_number, issue_date: source.issue_date } : null}
      correctionReason={creditNote.correction_reason}
    />
  );

  return (
    <PageBody>
      <UpgradeDialog
        open={gateOpen}
        onOpenChange={(v) => { setGateOpen(v); if (!v && isNew) navigate("/app/invoices"); }}
        featureKeyPrefix="billing.gates.creditNotes"
      />

      <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link to="/app/credit-notes"><ArrowLeft className="h-4 w-4" />{t("creditNotes.backToList")}</Link>
        </Button>
        <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 lg:hidden">
              <Eye className="h-4 w-4" />{t("invoices.actions.preview")}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-4">
            <SheetHeader>
              <SheetTitle>{t("creditNotes.preview.title")}</SheetTitle>
            </SheetHeader>
            <div className="mt-4">{previewNode}</div>
          </SheetContent>
        </Sheet>
      </div>

      <PageHeader
        title={number ?? (isNew ? t("creditNotes.newTitle") : t("creditNotes.editTitle"))}
        description={readonly ? t("creditNotes.readonlyDescription") : t("creditNotes.editorDescription")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant={
              status === "cancelled" ? "outline"
              : status === "draft" ? "secondary"
              : "default"
            }>
              {t(`creditNotes.status.${status}`, { defaultValue: status })}
            </Badge>
            {!readonly && (
              <>
                <Button variant="outline" onClick={onSave} disabled={saving} className="gap-1">
                  <Save className="h-4 w-4" />{t("invoices.actions.saveDraft")}
                </Button>
                <Button onClick={onIssue} disabled={issuing || exceedsCap} className="gap-1">
                  <Send className="h-4 w-4" />{t("creditNotes.actions.issue")}
                </Button>
              </>
            )}
            {!isNew && (
              <Button variant="outline" onClick={onDownloadPdf} disabled={downloading} className="gap-1">
                <Download className="h-4 w-4" />{t("invoices.actions.downloadPdf")}
              </Button>
            )}
            {!readonly && creditNote.id && (
              <Button variant="ghost" onClick={onCancelCreditNote} className="gap-1">
                <Ban className="h-4 w-4" />{t("invoices.cancel")}
              </Button>
            )}
          </div>
        }
      />

      {readonly && (
        <div className="surface p-3 mb-4 text-xs text-muted-foreground flex items-start gap-2">
          <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{t("creditNotes.issuedHint")}</span>
        </div>
      )}

      {/* Source invoice context block */}
      {source && (
        <div className="surface p-4 mb-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            {t("creditNotes.fields.sourceInvoice")}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <Link to={`/app/invoices/${source.id}`} className="font-mono hover:underline font-medium">
              {source.invoice_number ?? t("invoices.draftLabel")}
            </Link>
            <div className="text-muted-foreground">
              {t("invoices.preview.issueDate")}:{" "}
              <span className="text-foreground">
                {source.issue_date ? new Date(source.issue_date).toLocaleDateString(locale) : "—"}
              </span>
            </div>
            <div className="text-muted-foreground">
              {t("invoices.totals.totalTTC")}:{" "}
              <span className="text-foreground font-mono">
                {formatMoney(sourceTotal, source.currency_code, locale)}
              </span>
            </div>
            <div className="text-muted-foreground">
              {t("creditNotes.fields.alreadyCredited")}:{" "}
              <span className="text-foreground font-mono">
                {formatMoney(creditedSoFar, source.currency_code, locale)}
              </span>
            </div>
            <div className="text-muted-foreground">
              {t("creditNotes.fields.remainingCreditable")}:{" "}
              <span className="text-foreground font-mono">
                {formatMoney(remainingCreditable, source.currency_code, locale)}
              </span>
            </div>
          </div>
          {!readonly && exceedsCap && (
            <div className="mt-3 text-xs text-destructive">
              {t("creditNotes.errors.exceedsSourceTotal", {
                max: formatMoney(remainingCreditable, source.currency_code, locale),
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          {/* Locked client + currency */}
          <div className="surface p-5 space-y-4">
            <h2 className="font-serif text-lg">{t("invoices.sections.client")}</h2>
            <div>
              <Label className="flex items-center gap-1">
                <Lock className="h-3 w-3" /> {t("invoices.fields.client")}
              </Label>
              <Input
                value={(snapshotClient?.display_name ?? clientFull?.display_name) ?? ""}
                disabled
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("creditNotes.lockedFromSource")}
              </p>
            </div>

            <h2 className="font-serif text-lg pt-2">{t("invoices.sections.details")}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("invoices.fields.issueDate")}</Label>
                <Input type="date" value={creditNote.issue_date ?? ""} disabled={readonly}
                  onChange={(e) => setCreditNote({ ...creditNote, issue_date: e.target.value || null })} />
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  <Lock className="h-3 w-3" /> {t("invoices.fields.currency")}
                </Label>
                <Input value={creditNote.currency_code} disabled />
              </div>
            </div>

            <div>
              <Label>{t("creditNotes.fields.correctionReason")}</Label>
              <Textarea
                rows={2}
                value={creditNote.correction_reason ?? ""}
                disabled={readonly}
                placeholder={t("creditNotes.fields.correctionReasonPlaceholder") ?? ""}
                onChange={(e) => setCreditNote({
                  ...creditNote, correction_reason: e.target.value || null,
                })}
              />
            </div>
          </div>

          {/* Lines */}
          <div className="surface p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif text-lg">{t("creditNotes.sections.creditedLines")}</h2>
              {!readonly && (
                <Button size="sm" variant="outline" onClick={addLine} className="gap-1">
                  <Plus className="h-4 w-4" />{t("invoices.actions.addLine")}
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {lines.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  {t("creditNotes.preview.noLines")}
                </div>
              )}
              {lines.map((l, idx) => (
                <div key={idx} className="rounded-md border border-border p-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-12">
                      <Label className="text-xs">{t("invoices.line.label")}</Label>
                      <Input value={l.label} disabled={readonly}
                        onChange={(e) => updateLine(idx, { label: e.target.value })} />
                    </div>
                    <div className="sm:col-span-12">
                      <Label className="text-xs">{t("invoices.line.description")}</Label>
                      <Textarea rows={2} value={l.description ?? ""} disabled={readonly}
                        onChange={(e) => updateLine(idx, { description: e.target.value || null })} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">{t("invoices.line.quantity")}</Label>
                      <Input type="number" step="0.01" min="0" value={l.quantity} disabled={readonly}
                        onChange={(e) => updateLine(idx, { quantity: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">{t("invoices.line.unit")}</Label>
                      <Input value={l.unit ?? ""} disabled={readonly}
                        onChange={(e) => updateLine(idx, { unit: e.target.value || null })} />
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="text-xs">{t("invoices.line.unitPrice")}</Label>
                      <Input type="number" step="0.01" min="0" value={l.unit_price} disabled={readonly}
                        onChange={(e) => updateLine(idx, { unit_price: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">{t("invoices.line.vatRate")}</Label>
                      <Input type="number" step="0.01" min="0" max="100" value={l.vat_rate} disabled={readonly}
                        onChange={(e) => updateLine(idx, { vat_rate: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="sm:col-span-3 flex items-end justify-end gap-1">
                      {!readonly && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => moveLine(idx, -1)} aria-label="up">
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => moveLine(idx, 1)} aria-label="down">
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => removeLine(idx)} aria-label="remove">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    {t("invoices.line.lineTotal")}:{" "}
                    {formatMoney(l.quantity * l.unit_price * (1 + l.vat_rate / 100), creditNote.currency_code, locale)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface p-5">
            <h2 className="font-serif text-lg mb-3">{t("invoices.sections.totals")}</h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>{t("invoices.totals.subtotalHT")}</span>
                <span className="font-mono">{formatMoney(totals.subtotal_ht, creditNote.currency_code, locale)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t("invoices.totals.totalVat")}</span>
                <span className="font-mono">{formatMoney(totals.total_vat, creditNote.currency_code, locale)}</span>
              </div>
              <div className="flex justify-between text-base font-medium pt-1 border-t border-border mt-2">
                <span>{t("creditNotes.totals.totalCredit")}</span>
                <span className="font-mono">{formatMoney(totals.total_ttc, creditNote.currency_code, locale)}</span>
              </div>
            </div>
          </div>

          <div className="surface p-5">
            <h2 className="font-serif text-lg mb-3">{t("invoices.sections.notes")}</h2>
            <Textarea rows={3} value={creditNote.notes ?? ""} disabled={readonly}
              onChange={(e) => setCreditNote({ ...creditNote, notes: e.target.value })} />
          </div>
        </div>

        {/* Live preview */}
        <aside className="hidden lg:block">
          <div className="sticky top-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              {t("creditNotes.preview.title")}
            </div>
            <div ref={previewRef}>{previewNode}</div>
          </div>
        </aside>
      </div>

      {/* Off-screen render for clean PDF capture */}
      <div
        aria-hidden
        style={{
          position: "fixed", left: "-10000px", top: 0,
          width: "794px", background: "#ffffff",
        }}
      >
        <div ref={offscreenRef}>{previewNode}</div>
      </div>
    </PageBody>
  );
}
