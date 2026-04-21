/**
 * Documents data layer (invoices + devis) — tenant-scoped.
 * Single source of truth for document + lines persistence so UI components
 * never duplicate save/numbering logic.
 *
 * Both invoice and devis share the `invoices` table; the `document_type`
 * column ("invoice" | "devis") routes labels, numbering prefix and lifecycle.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { computeInvoiceTotals, computeLine, type LineInput } from "@/lib/invoice-totals";
import { loadPrimaryCompany } from "@/lib/company-profile";

export type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
export type InvoiceLineRow = Database["public"]["Tables"]["invoice_lines"]["Row"];
export type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];
export type DocumentType = Database["public"]["Enums"]["invoice_document_type"];

export type EditorLine = {
  id?: string;
  sort_order: number;
  item_id: string | null;
  activity_id: string | null;
  item_type: Database["public"]["Enums"]["item_type"] | null;
  label: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unit_price: number;
  vat_rate: number;
};

export type EditorInvoice = {
  id?: string;
  client_id: string | null;
  issue_date: string | null; // YYYY-MM-DD
  due_date: string | null;
  currency_code: string;
  document_language: Database["public"]["Enums"]["document_language"];
  notes: string | null;
};

export const newEmptyLine = (sort_order: number): EditorLine => ({
  sort_order,
  item_id: null,
  activity_id: null,
  item_type: null,
  label: "",
  description: null,
  quantity: 1,
  unit: "unit",
  unit_price: 0,
  vat_rate: 20,
});

export async function listInvoices(tenantId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, client:clients(display_name)")
    .eq("tenant_id", tenantId)
    .eq("document_type", "invoice")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listDevis(tenantId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, client:clients(display_name)")
    .eq("tenant_id", tenantId)
    .eq("document_type", "devis")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function loadInvoiceWithLines(invoiceId: string) {
  const [invRes, linesRes] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", invoiceId).single(),
    supabase.from("invoice_lines").select("*").eq("invoice_id", invoiceId).order("sort_order"),
  ]);
  if (invRes.error) throw invRes.error;
  if (linesRes.error) throw linesRes.error;
  return { invoice: invRes.data as InvoiceRow, lines: (linesRes.data ?? []) as InvoiceLineRow[] };
}

function totalsFromLines(lines: EditorLine[]) {
  const inputs: LineInput[] = lines.map((l) => ({
    quantity: l.quantity, unit_price: l.unit_price, vat_rate: l.vat_rate,
  }));
  return computeInvoiceTotals(inputs);
}

/**
 * Save a draft document (invoice or devis). Default document type is "invoice"
 * for backward compatibility with existing call sites.
 */
export async function saveDraft(
  tenantId: string,
  userId: string | null,
  inv: EditorInvoice,
  lines: EditorLine[],
  documentType: DocumentType = "invoice",
  extra?: { source_devis_id?: string | null },
): Promise<string> {
  const totals = totalsFromLines(lines);
  const company = await loadPrimaryCompany(tenantId);
  const sellerSnapshot = company ? {
    company_name: company.company_name,
    legal_name: company.legal_name,
    siren: company.siren, siret: company.siret,
    vat_number: company.vat_number, vat_regime: company.vat_regime,
    address_line1: company.address_line1, address_line2: company.address_line2,
    postal_code: company.postal_code, city: company.city,
    email: company.email, phone: company.phone,
    logo_url: company.logo_url,
    payment_defaults: company.payment_defaults,
  } : {};

  let clientSnapshot: Record<string, unknown> = {};
  if (inv.client_id) {
    const { data: c } = await supabase.from("clients").select("*").eq("id", inv.client_id).maybeSingle();
    if (c) clientSnapshot = {
      display_name: c.display_name, legal_name: c.legal_name,
      email: c.email, phone: c.phone, vat_number: c.vat_number,
      address_line1: c.address_line1, address_line2: c.address_line2,
      postal_code: c.postal_code, city: c.city, country_code: c.country_code,
      client_type: c.client_type,
    };
  }

  const payload: Record<string, unknown> = {
    tenant_id: tenantId,
    company_id: company?.id ?? null,
    client_id: inv.client_id,
    document_type: documentType,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    currency_code: inv.currency_code || "EUR",
    document_language: inv.document_language,
    notes: inv.notes,
    subtotal_ht: totals.subtotal_ht,
    total_vat: totals.total_vat,
    total_ttc: totals.total_ttc,
    seller_snapshot: sellerSnapshot as any,
    client_snapshot: clientSnapshot as any,
    legal_requirements_snapshot: (company?.legal_requirements ?? {}) as any,
    updated_by: userId,
  };
  if (extra && "source_devis_id" in extra) {
    payload.source_devis_id = extra.source_devis_id ?? null;
  }

  let invoiceId = inv.id;
  if (invoiceId) {
    const { error } = await supabase.from("invoices").update(payload as any).eq("id", invoiceId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("invoices")
      .insert({ ...payload, status: "draft", created_by: userId } as any)
      .select("id").single();
    if (error) throw error;
    invoiceId = data.id;
  }

  // Replace lines (V1 strategy: deterministic + simple).
  await supabase.from("invoice_lines").delete().eq("invoice_id", invoiceId);
  if (lines.length) {
    const rows = lines.map((l, idx) => {
      const t = computeLine({ quantity: l.quantity, unit_price: l.unit_price, vat_rate: l.vat_rate });
      return {
        invoice_id: invoiceId!,
        tenant_id: tenantId,
        sort_order: idx,
        item_id: l.item_id,
        activity_id: l.activity_id,
        item_type: l.item_type,
        label: l.label || "",
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unit_price: l.unit_price,
        vat_rate: l.vat_rate,
        line_subtotal_ht: t.line_subtotal_ht,
        line_vat_amount: t.line_vat_amount,
        line_total_ttc: t.line_total_ttc,
      };
    });
    const { error } = await supabase.from("invoice_lines").insert(rows);
    if (error) throw error;
  }

  return invoiceId!;
}

/** Issue a draft invoice: claim a number, set status=issued, freeze issue_date. */
export async function issueInvoice(tenantId: string, invoiceId: string): Promise<string> {
  const today = new Date();
  const yyyy = today.getFullYear();
  const iso = today.toISOString().slice(0, 10);

  const { data: numData, error: numErr } = await supabase.rpc("claim_invoice_number", {
    _tenant_id: tenantId, _document_type: "invoice", _year: yyyy,
  });
  if (numErr) throw numErr;
  const number = numData as unknown as string;

  const { error } = await supabase
    .from("invoices")
    .update({
      status: "issued",
      invoice_number: number,
      issue_date: iso,
      issued_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);
  if (error) throw error;
  return number;
}

/** Issue a draft devis: claim a DEV number, set status=sent, freeze issue_date. */
export async function issueDevis(tenantId: string, devisId: string): Promise<string> {
  const today = new Date();
  const yyyy = today.getFullYear();
  const iso = today.toISOString().slice(0, 10);

  const { data: numData, error: numErr } = await supabase.rpc("claim_invoice_number", {
    _tenant_id: tenantId, _document_type: "devis", _year: yyyy,
  });
  if (numErr) throw numErr;
  const number = numData as unknown as string;

  const { error } = await supabase
    .from("invoices")
    .update({
      status: "sent" as InvoiceStatus,
      invoice_number: number,
      issue_date: iso,
      issued_at: new Date().toISOString(),
    } as any)
    .eq("id", devisId);
  if (error) throw error;
  return number;
}

/** Set a devis to a lifecycle status (accepted/rejected/expired/cancelled). */
export async function setDevisStatus(devisId: string, status: InvoiceStatus): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "cancelled") patch.cancelled_at = new Date().toISOString();
  const { error } = await supabase.from("invoices").update(patch as any).eq("id", devisId);
  if (error) throw error;
}

export async function cancelInvoice(invoiceId: string) {
  const { error } = await supabase
    .from("invoices")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (error) throw error;
}

export async function duplicateInvoice(tenantId: string, userId: string | null, invoiceId: string): Promise<string> {
  const { invoice, lines } = await loadInvoiceWithLines(invoiceId);
  const editorInv: EditorInvoice = {
    client_id: invoice.client_id,
    issue_date: null, // fresh draft
    due_date: invoice.due_date,
    currency_code: invoice.currency_code,
    document_language: invoice.document_language,
    notes: invoice.notes,
  };
  const editorLines: EditorLine[] = lines.map((l, i) => ({
    sort_order: i,
    item_id: l.item_id, activity_id: l.activity_id, item_type: l.item_type,
    label: l.label, description: l.description,
    quantity: Number(l.quantity), unit: l.unit,
    unit_price: Number(l.unit_price), vat_rate: Number(l.vat_rate),
  }));
  return saveDraft(tenantId, userId, editorInv, editorLines, invoice.document_type);
}

/**
 * Convert a devis (any state) into a NEW invoice draft.
 * The original devis is preserved; the new invoice carries `source_devis_id`.
 * Returns the new invoice id.
 */
export async function convertDevisToInvoice(
  tenantId: string,
  userId: string | null,
  devisId: string,
): Promise<string> {
  const { invoice, lines } = await loadInvoiceWithLines(devisId);
  if (invoice.document_type !== "devis") throw new Error("not_a_devis");
  const today = new Date();
  const due = new Date(today); due.setDate(due.getDate() + 30);
  const editorInv: EditorInvoice = {
    client_id: invoice.client_id,
    issue_date: today.toISOString().slice(0, 10),
    due_date: due.toISOString().slice(0, 10),
    currency_code: invoice.currency_code,
    document_language: invoice.document_language,
    notes: invoice.notes,
  };
  const editorLines: EditorLine[] = lines.map((l, i) => ({
    sort_order: i,
    item_id: l.item_id, activity_id: l.activity_id, item_type: l.item_type,
    label: l.label, description: l.description,
    quantity: Number(l.quantity), unit: l.unit,
    unit_price: Number(l.unit_price), vat_rate: Number(l.vat_rate),
  }));
  return saveDraft(tenantId, userId, editorInv, editorLines, "invoice", { source_devis_id: devisId });
}
