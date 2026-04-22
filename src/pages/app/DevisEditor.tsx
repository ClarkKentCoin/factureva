/**
 * DevisEditor — structured editor for quotes (devis).
 * Reuses the same data engine and InvoicePreview as invoices, with
 * devis-specific labels, numbering (DEV-YYYY-NNNNNN), statuses
 * (draft / sent / accepted / rejected / expired / cancelled), and a
 * "Convert to invoice" action.
 *
 * Note: no payment recording on devis (payments only apply to invoices).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, Send, Save, Eye, Copy,
  Download, Mail, ArrowRightLeft, CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageBody, PageHeader } from "@/components/layout/PageScaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  loadInvoiceWithLines, saveDraft, issueDevis, duplicateInvoice,
  setDevisStatus, convertDevisToInvoice, newEmptyLine,
  type EditorInvoice, type EditorLine, type InvoiceStatus,
} from "@/lib/invoices";
import { computeInvoiceTotals, formatMoney } from "@/lib/invoice-totals";
import { loadPrimaryCompany, type CompanyRow } from "@/lib/company-profile";
import InvoicePreview, { type PreviewClient, type PreviewCompany } from "@/components/invoices/InvoicePreview";
import SendInvoiceEmailDialog from "@/components/invoices/SendInvoiceEmailDialog";
import { renderInvoicePdf, downloadBlob } from "@/lib/invoice-pdf";

type ClientLite = { id: string; display_name: string };
type ItemLite = {
  id: string; name: string; default_unit: string | null;
  default_unit_price: number | null; default_vat_rate: number | null;
  item_type: "service" | "good" | "mixed"; activity_id: string | null;
};

const NO_CLIENT = "__none__";
const CUSTOM_ITEM = "__custom__";

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (days: number) => {
  const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10);
};

export default function DevisEditorPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenantId, user } = useAuth();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [status, setStatus] = useState<InvoiceStatus>("draft");
  const [number, setNumber] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<EditorInvoice>({
    client_id: null,
    issue_date: todayISO(),
    due_date: addDaysISO(30),
    currency_code: "EUR",
    document_language: "fr",
    notes: "",
  });
  const [lines, setLines] = useState<EditorLine[]>([newEmptyLine(0)]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [items, setItems] = useState<ItemLite[]>([]);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [clientFull, setClientFull] = useState<PreviewClient | null>(null);
  const [snapshotSeller, setSnapshotSeller] = useState<PreviewCompany | null>(null);
  const [snapshotClient, setSnapshotClient] = useState<PreviewClient | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [lastSentTo, setLastSentTo] = useState<string | null>(null);
  const [clientSignatureUrl, setClientSignatureUrl] = useState<string | null>(null);
  const [uploadingClientSig, setUploadingClientSig] = useState(false);
  const clientSigInputRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const offscreenRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!currentTenantId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [clRes, itRes, comp] = await Promise.all([
          supabase.from("clients").select("id, display_name")
            .eq("tenant_id", currentTenantId).eq("is_active", true).order("display_name"),
          supabase.from("items")
            .select("id, name, default_unit, default_unit_price, default_vat_rate, item_type, activity_id")
            .eq("tenant_id", currentTenantId).eq("is_active", true).order("name"),
          loadPrimaryCompany(currentTenantId),
        ]);
        if (!alive) return;
        setClients((clRes.data ?? []) as ClientLite[]);
        setItems((itRes.data ?? []) as ItemLite[]);
        setCompany(comp);

        if (!isNew && id) {
          const { invoice: inv } = await loadInvoiceWithLines(id);
          if (inv.document_type !== "devis") {
            // Wrong type — bounce to the matching editor.
            navigate(`/app/invoices/${id}`, { replace: true });
            return;
          }
          const { lines: ls } = await loadInvoiceWithLines(id);
          if (!alive) return;
          setStatus(inv.status); setNumber(inv.invoice_number);
          setInvoice({
            id: inv.id, client_id: inv.client_id,
            issue_date: inv.issue_date, due_date: inv.due_date,
            currency_code: inv.currency_code,
            document_language: inv.document_language,
            notes: inv.notes ?? "",
          });
          setLines(ls.length ? ls.map((l, i) => ({
            id: l.id, sort_order: i,
            item_id: l.item_id, activity_id: l.activity_id, item_type: l.item_type,
            label: l.label, description: l.description,
            quantity: Number(l.quantity), unit: l.unit,
            unit_price: Number(l.unit_price), vat_rate: Number(l.vat_rate),
          })) : [newEmptyLine(0)]);
          setLastSentAt((inv as { last_sent_at?: string | null }).last_sent_at ?? null);
          setLastSentTo((inv as { last_sent_to?: string | null }).last_sent_to ?? null);
          setClientSignatureUrl((inv as { client_signature_url?: string | null }).client_signature_url ?? null);
          if (inv.status !== "draft") {
            setSnapshotSeller((inv.seller_snapshot ?? null) as PreviewCompany | null);
            setSnapshotClient((inv.client_snapshot ?? null) as PreviewClient | null);
          }
        }
      } catch { toast.error(t("common.loadError")); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [currentTenantId, id, isNew, t, navigate]);

  useEffect(() => {
    if (status !== "draft") return;
    if (!invoice.client_id) { setClientFull(null); return; }
    let alive = true;
    supabase.from("clients").select("*").eq("id", invoice.client_id).maybeSingle()
      .then(({ data }) => { if (alive) setClientFull(data as PreviewClient | null); });
    return () => { alive = false; };
  }, [invoice.client_id, status]);

  const totals = useMemo(() => computeInvoiceTotals(
    lines.map((l) => ({ quantity: l.quantity, unit_price: l.unit_price, vat_rate: l.vat_rate }))
  ), [lines]);

  const locale = i18n.language === "fr" ? "fr-FR" : i18n.language === "ru" ? "ru-RU" : "en-GB";
  const readonly = status !== "draft";

  const previewCompany: PreviewCompany | null = readonly ? snapshotSeller : (company ? {
    logo_url: company.logo_url,
    signature_url: (company as any).signature_url ?? null,
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
  const removeLine = (idx: number) => setLines((p) => p.filter((_, i) => i !== idx).map((l, i) => ({ ...l, sort_order: i })));
  const moveLine = (idx: number, dir: -1 | 1) => {
    setLines((p) => {
      const arr = [...p]; const j = idx + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return arr.map((l, i) => ({ ...l, sort_order: i }));
    });
  };

  const pickItem = (idx: number, value: string) => {
    if (value === CUSTOM_ITEM) { updateLine(idx, { item_id: null }); return; }
    const it = items.find((x) => x.id === value);
    if (!it) return;
    updateLine(idx, {
      item_id: it.id,
      activity_id: it.activity_id,
      item_type: it.item_type,
      label: it.name,
      unit: it.default_unit ?? "unit",
      unit_price: Number(it.default_unit_price ?? 0),
      vat_rate: Number(it.default_vat_rate ?? 0),
    });
  };

  const onSave = async () => {
    if (!currentTenantId) return;
    setSaving(true);
    try {
      const newId = await saveDraft(currentTenantId, user?.id ?? null, invoice, lines, "devis");
      toast.success(t("devis.toasts.saved"));
      if (isNew) navigate(`/app/devis/${newId}`, { replace: true });
      else setInvoice((p) => ({ ...p, id: newId }));
    } catch (e: any) { toast.error(e?.message || t("common.saveError")); }
    finally { setSaving(false); }
  };

  const onIssue = async () => {
    if (!currentTenantId) return;
    if (!invoice.client_id) { toast.error(t("invoices.errors.clientRequired")); return; }
    if (lines.length === 0 || lines.some((l) => !l.label.trim())) {
      toast.error(t("invoices.errors.linesRequired")); return;
    }
    setIssuing(true);
    try {
      const newId = await saveDraft(currentTenantId, user?.id ?? null, invoice, lines, "devis");
      const num = await issueDevis(currentTenantId, newId);
      toast.success(t("devis.toasts.issued", { number: num }));
      navigate(`/app/devis/${newId}`, { replace: true });
      setTimeout(() => window.location.reload(), 50);
    } catch (e: any) { toast.error(e?.message || t("common.saveError")); }
    finally { setIssuing(false); }
  };

  const onDuplicate = async () => {
    if (!currentTenantId || !invoice.id) return;
    try {
      const newId = await duplicateInvoice(currentTenantId, user?.id ?? null, invoice.id);
      toast.success(t("devis.toasts.duplicated"));
      navigate(`/app/devis/${newId}`);
    } catch { toast.error(t("common.saveError")); }
  };

  const setLifecycle = async (next: InvoiceStatus) => {
    if (!invoice.id) return;
    setStatusUpdating(true);
    try {
      await setDevisStatus(invoice.id, next);
      setStatus(next);
      toast.success(t(`devis.toasts.statusSet.${next}`, { defaultValue: t("common.saved") }));
    } catch { toast.error(t("common.saveError")); }
    finally { setStatusUpdating(false); }
  };

  const onConvert = async () => {
    if (!currentTenantId || !invoice.id) return;
    try {
      const newInvId = await convertDevisToInvoice(currentTenantId, user?.id ?? null, invoice.id);
      toast.success(t("devis.toasts.converted"));
      navigate(`/app/invoices/${newInvId}`);
    } catch { toast.error(t("common.saveError")); }
  };

  const pdfFilename = () => {
    const base = number ?? `devis-draft-${invoice.id ?? "new"}`;
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

  const emailDefaults = useMemo(() => {
    const recipient = (readonly ? snapshotClient?.email : clientFull?.email) ?? "";
    const sellerName = previewCompany?.company_name ?? "";
    const docNum = number ?? t("devis.draftLabel");
    const subject = t("devis.email.defaults.subject", { number: docNum, company: sellerName });
    const body = t("devis.email.defaults.body", { number: docNum, company: sellerName });
    return { recipient: recipient || "", subject, body };
  }, [readonly, snapshotClient, clientFull, previewCompany, number, t]);

  if (loading) return <PageBody><div className="surface p-6 text-sm text-muted-foreground">{t("common.loading")}</div></PageBody>;

  const previewNode = (
    <InvoicePreview
      invoice={invoice}
      lines={lines}
      number={number}
      status={status}
      company={previewCompany}
      client={previewClient}
      kind="devis"
    />
  );

  return (
    <PageBody>
      <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link to="/app/devis"><ArrowLeft className="h-4 w-4" />{t("devis.backToList")}</Link>
        </Button>
        <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 lg:hidden">
              <Eye className="h-4 w-4" />{t("invoices.actions.preview")}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-4">
            <SheetHeader>
              <SheetTitle>{t("invoices.preview.title")}</SheetTitle>
            </SheetHeader>
            <div className="mt-4">{previewNode}</div>
          </SheetContent>
        </Sheet>
      </div>

      <PageHeader
        title={number ?? (isNew ? t("devis.newTitle") : t("devis.editTitle"))}
        description={readonly ? t("devis.readonlyDescription") : t("devis.editorDescription")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant={
              status === "draft" ? "secondary"
              : status === "rejected" ? "destructive"
              : status === "cancelled" || status === "expired" ? "outline"
              : "default"
            }>
              {t(`devis.status.${status}`, { defaultValue: status })}
            </Badge>
            {!readonly && (
              <>
                <Button variant="outline" onClick={onSave} disabled={saving} className="gap-1">
                  <Save className="h-4 w-4" />{t("invoices.actions.saveDraft")}
                </Button>
                <Button onClick={onIssue} disabled={issuing} className="gap-1">
                  <Send className="h-4 w-4" />{t("devis.actions.issue")}
                </Button>
              </>
            )}
            {status === "sent" && (
              <>
                <Button variant="outline" onClick={() => setLifecycle("accepted")} disabled={statusUpdating} className="gap-1">
                  <CheckCircle2 className="h-4 w-4" />{t("devis.actions.markAccepted")}
                </Button>
                <Button variant="outline" onClick={() => setLifecycle("rejected")} disabled={statusUpdating} className="gap-1">
                  <XCircle className="h-4 w-4" />{t("devis.actions.markRejected")}
                </Button>
                <Button variant="outline" onClick={() => setLifecycle("expired")} disabled={statusUpdating} className="gap-1">
                  <Clock className="h-4 w-4" />{t("devis.actions.markExpired")}
                </Button>
              </>
            )}
            {(status === "accepted" || status === "sent") && invoice.id && (
              <Button onClick={onConvert} className="gap-1">
                <ArrowRightLeft className="h-4 w-4" />{t("devis.actions.convert")}
              </Button>
            )}
            {!isNew && (
              <Button variant="outline" onClick={onDownloadPdf} disabled={downloading} className="gap-1">
                <Download className="h-4 w-4" />{t("invoices.actions.downloadPdf")}
              </Button>
            )}
            {readonly && invoice.id && (
              <Button variant="outline" onClick={() => setEmailOpen(true)} className="gap-1">
                <Mail className="h-4 w-4" />{t("invoices.actions.sendEmail")}
              </Button>
            )}
            {readonly && (
              <Button variant="outline" onClick={onDuplicate} className="gap-1">
                <Copy className="h-4 w-4" />{t("invoices.duplicate")}
              </Button>
            )}
          </div>
        }
      />

      {readonly && (
        <div className="surface p-3 mb-4 text-xs text-muted-foreground">
          {t("devis.issuedHint")}
        </div>
      )}

      {lastSentAt && (
        <div className="surface p-3 mb-4 text-xs text-muted-foreground flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span>
            {t("invoices.email.lastSent", {
              to: lastSentTo ?? "—",
              when: new Date(lastSentAt).toLocaleString(locale),
            })}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="surface p-5 space-y-4">
            <h2 className="font-serif text-lg">{t("invoices.sections.client")}</h2>
            <div>
              <Label>{t("invoices.fields.client")}</Label>
              <Select
                value={invoice.client_id ?? NO_CLIENT}
                onValueChange={(v) => setInvoice({ ...invoice, client_id: v === NO_CLIENT ? null : v })}
                disabled={readonly}
              >
                <SelectTrigger><SelectValue placeholder={t("invoices.fields.clientPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT}>{t("invoices.noClient")}</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clients.length === 0 && !readonly && (
                <p className="text-xs text-muted-foreground mt-1">
                  <Link to="/app/clients" className="underline">{t("invoices.createClientHint")}</Link>
                </p>
              )}
            </div>

            <h2 className="font-serif text-lg pt-2">{t("invoices.sections.details")}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("invoices.fields.issueDate")}</Label>
                <Input type="date" value={invoice.issue_date ?? ""} disabled={readonly}
                  onChange={(e) => setInvoice({ ...invoice, issue_date: e.target.value || null })} />
              </div>
              <div>
                <Label>{t("devis.fields.validUntil")}</Label>
                <Input type="date" value={invoice.due_date ?? ""} disabled={readonly}
                  onChange={(e) => setInvoice({ ...invoice, due_date: e.target.value || null })} />
              </div>
              <div>
                <Label>{t("invoices.fields.currency")}</Label>
                <Input value={invoice.currency_code} disabled={readonly}
                  onChange={(e) => setInvoice({ ...invoice, currency_code: e.target.value.toUpperCase().slice(0, 3) })} />
              </div>
              <div>
                <Label>{t("invoices.fields.docLang")}</Label>
                <Select value={invoice.document_language}
                  onValueChange={(v) => setInvoice({ ...invoice, document_language: v as any })}
                  disabled={readonly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">FR</SelectItem>
                    <SelectItem value="en">EN</SelectItem>
                    <SelectItem value="ru">RU</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="surface p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif text-lg">{t("invoices.sections.lines")}</h2>
              {!readonly && (
                <Button size="sm" variant="outline" onClick={addLine} className="gap-1">
                  <Plus className="h-4 w-4" />{t("invoices.actions.addLine")}
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {lines.map((l, idx) => (
                <div key={idx} className="rounded-md border border-border p-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    {!readonly && (
                      <div className="sm:col-span-6">
                        <Label className="text-xs">{t("invoices.line.itemPicker")}</Label>
                        <Select
                          value={l.item_id ?? CUSTOM_ITEM}
                          onValueChange={(v) => pickItem(idx, v)}
                          disabled={readonly}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={CUSTOM_ITEM}>{t("invoices.line.customLine")}</SelectItem>
                            {items.map((it) => (
                              <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className={readonly ? "sm:col-span-12" : "sm:col-span-6"}>
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
                    {formatMoney(l.quantity * l.unit_price * (1 + l.vat_rate / 100), invoice.currency_code, locale)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface p-5">
            <h2 className="font-serif text-lg mb-3">{t("invoices.sections.totals")}</h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>{t("invoices.totals.subtotalHT")}</span>
                <span className="font-mono">{formatMoney(totals.subtotal_ht, invoice.currency_code, locale)}</span></div>
              <div className="flex justify-between"><span>{t("invoices.totals.totalVat")}</span>
                <span className="font-mono">{formatMoney(totals.total_vat, invoice.currency_code, locale)}</span></div>
              <div className="flex justify-between text-base font-medium pt-1 border-t border-border mt-2">
                <span>{t("invoices.totals.totalTTC")}</span>
                <span className="font-mono">{formatMoney(totals.total_ttc, invoice.currency_code, locale)}</span>
              </div>
            </div>
          </div>

          <div className="surface p-5">
            <h2 className="font-serif text-lg mb-3">{t("invoices.sections.notes")}</h2>
            <Textarea rows={3} value={invoice.notes ?? ""} disabled={readonly}
              onChange={(e) => setInvoice({ ...invoice, notes: e.target.value })} />
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              {t("invoices.preview.title")}
            </div>
            <div ref={previewRef}>{previewNode}</div>
          </div>
        </aside>
      </div>

      <div
        aria-hidden
        style={{
          position: "fixed", left: "-10000px", top: 0,
          width: "794px",
          background: "#ffffff",
        }}
      >
        <div ref={offscreenRef}>{previewNode}</div>
      </div>

      <SendInvoiceEmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        invoiceId={invoice.id ?? null}
        defaults={emailDefaults}
        generatePdf={async () => {
          const { base64, filename } = await renderForCapture();
          return { base64, filename };
        }}
        onSent={(to) => {
          setLastSentAt(new Date().toISOString());
          setLastSentTo(to);
        }}
      />
    </PageBody>
  );
}
