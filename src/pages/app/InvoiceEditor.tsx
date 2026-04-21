import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, Send, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageBody, PageHeader } from "@/components/layout/PageScaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  loadInvoiceWithLines, saveDraft, issueInvoice, newEmptyLine,
  type EditorInvoice, type EditorLine, type InvoiceStatus,
} from "@/lib/invoices";
import { computeInvoiceTotals, formatMoney } from "@/lib/invoice-totals";

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

export default function InvoiceEditorPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenantId, user } = useAuth();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
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

  useEffect(() => {
    if (!currentTenantId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [clRes, itRes] = await Promise.all([
          supabase.from("clients").select("id, display_name")
            .eq("tenant_id", currentTenantId).eq("is_active", true).order("display_name"),
          supabase.from("items")
            .select("id, name, default_unit, default_unit_price, default_vat_rate, item_type, activity_id")
            .eq("tenant_id", currentTenantId).eq("is_active", true).order("name"),
        ]);
        if (!alive) return;
        setClients((clRes.data ?? []) as ClientLite[]);
        setItems((itRes.data ?? []) as ItemLite[]);

        if (!isNew && id) {
          const { invoice: inv, lines: ls } = await loadInvoiceWithLines(id);
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
        }
      } catch { toast.error(t("common.loadError")); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [currentTenantId, id, isNew, t]);

  const totals = useMemo(() => computeInvoiceTotals(
    lines.map((l) => ({ quantity: l.quantity, unit_price: l.unit_price, vat_rate: l.vat_rate }))
  ), [lines]);

  const locale = i18n.language === "fr" ? "fr-FR" : i18n.language === "ru" ? "ru-RU" : "en-GB";
  const readonly = status !== "draft";

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
      const newId = await saveDraft(currentTenantId, user?.id ?? null, invoice, lines);
      toast.success(t("invoices.toasts.saved"));
      if (isNew) navigate(`/app/invoices/${newId}`, { replace: true });
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
      const newId = await saveDraft(currentTenantId, user?.id ?? null, invoice, lines);
      const num = await issueInvoice(currentTenantId, newId);
      toast.success(t("invoices.toasts.issued", { number: num }));
      navigate(`/app/invoices/${newId}`);
    } catch (e: any) { toast.error(e?.message || t("common.saveError")); }
    finally { setIssuing(false); }
  };

  if (loading) return <PageBody><div className="surface p-6 text-sm text-muted-foreground">{t("common.loading")}</div></PageBody>;

  return (
    <PageBody>
      <div className="mb-3">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link to="/app/invoices"><ArrowLeft className="h-4 w-4" />{t("invoices.backToList")}</Link>
        </Button>
      </div>
      <PageHeader
        title={number ?? (isNew ? t("invoices.newTitle") : t("invoices.editTitle"))}
        description={t("invoices.editorDescription")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant={status === "draft" ? "secondary" : "default"}>{t(`invoices.status.${status}`)}</Badge>
            {!readonly && (
              <>
                <Button variant="outline" onClick={onSave} disabled={saving} className="gap-1">
                  <Save className="h-4 w-4" />{t("invoices.actions.saveDraft")}
                </Button>
                <Button onClick={onIssue} disabled={issuing} className="gap-1">
                  <Send className="h-4 w-4" />{t("invoices.actions.issue")}
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: client + details */}
        <div className="surface p-5 space-y-4 lg:col-span-1">
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
            {clients.length === 0 && (
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
              <Label>{t("invoices.fields.dueDate")}</Label>
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

        {/* Right: lines + totals + notes */}
        <div className="lg:col-span-2 space-y-4">
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
                    <div className="sm:col-span-6">
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
      </div>
    </PageBody>
  );
}
