/**
 * Credit notes (Avoirs) data layer.
 *
 * A credit note is a `document_type = 'credit_note'` row in the shared `invoices`
 * table. It MUST point to an existing `invoice` document via `source_invoice_id`.
 * The DB enforces:
 *   - source must exist and have document_type = 'invoice'
 *   - cumulative issued credit notes cannot exceed the source invoice total_ttc
 *
 * Numbering: AV-YYYY-NNNNNN, claimed via `claim_invoice_number(... 'credit_note')`.
 * Statuses for V1: draft → issued; or cancelled.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { computeInvoiceTotals, computeLine, type LineInput } from "@/lib/invoice-totals";
import { loadPrimaryCompany } from "@/lib/company-profile";
import {
  loadInvoiceWithLines, newEmptyLine,
  type EditorInvoice, type EditorLine, type InvoiceRow, type InvoiceLineRow, type InvoiceStatus,
} from "@/lib/invoices";

export type CreditNoteEditor = EditorInvoice & {
  source_invoice_id: string;
  correction_reason: string | null;
};

/** List credit notes for a tenant (most recent first). */
export async function listCreditNotes(tenantId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, client:clients(id, display_name, email, phone), source:source_invoice_id(id, invoice_number, total_ttc)")
    .eq("tenant_id", tenantId)
    .eq("document_type", "credit_note" as Database["public"]["Enums"]["invoice_document_type"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** All issued, non-cancelled credit notes linked to a given source invoice. */
export async function listCreditsForInvoice(sourceInvoiceId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, issue_date, total_ttc, currency_code")
    .eq("document_type", "credit_note" as Database["public"]["Enums"]["invoice_document_type"])
    .eq("source_invoice_id", sourceInvoiceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Sum of issued (non-cancelled) credit notes for one source invoice. */
export async function sumIssuedCreditsForInvoice(sourceInvoiceId: string): Promise<number> {
  const rows = await listCreditsForInvoice(sourceInvoiceId);
  return rows
    .filter((r: any) => r.status === "issued")
    .reduce((s: number, r: any) => s + Number(r.total_ttc || 0), 0);
}

/** Build editor lines pre-filled from a source invoice (full credit). */
export async function buildEditorFromSource(sourceInvoiceId: string): Promise<{
  source: InvoiceRow;
  invoice: CreditNoteEditor;
  lines: EditorLine[];
}> {
  const { invoice, lines } = await loadInvoiceWithLines(sourceInvoiceId);
  if (invoice.document_type !== "invoice") {
    throw new Error("credit_note_source_must_be_invoice");
  }
  const editorInv: CreditNoteEditor = {
    client_id: invoice.client_id,
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: null,
    currency_code: invoice.currency_code,
    document_language: invoice.document_language,
    notes: null,
    source_invoice_id: invoice.id,
    correction_reason: null,
  };
  const editorLines: EditorLine[] = (lines as InvoiceLineRow[]).map((l, i) => ({
    sort_order: i,
    item_id: l.item_id,
    activity_id: l.activity_id,
    item_type: l.item_type,
    label: l.label,
    description: l.description,
    quantity: Number(l.quantity),
    unit: l.unit,
    unit_price: Number(l.unit_price),
    vat_rate: Number(l.vat_rate),
  }));
  return { source: invoice, invoice: editorInv, lines: editorLines };
}

/** Empty starter for a partial credit note linked to a source invoice. */
export function emptyEditorFromSource(source: InvoiceRow): { invoice: CreditNoteEditor; lines: EditorLine[] } {
  return {
    invoice: {
      client_id: source.client_id,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: null,
      currency_code: source.currency_code,
      document_language: source.document_language,
      notes: null,
      source_invoice_id: source.id,
      correction_reason: null,
    },
    lines: [newEmptyLine(0)],
  };
}

function totalsFromLines(lines: EditorLine[]) {
  const inputs: LineInput[] = lines.map((l) => ({
    quantity: l.quantity, unit_price: l.unit_price, vat_rate: l.vat_rate,
  }));
  return computeInvoiceTotals(inputs);
}

/** Create or update a draft credit note. */
export async function saveCreditNoteDraft(
  tenantId: string,
  userId: string | null,
  cn: CreditNoteEditor & { id?: string },
  lines: EditorLine[],
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
  if (cn.client_id) {
    const { data: c } = await supabase.from("clients").select("*").eq("id", cn.client_id).maybeSingle();
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
    client_id: cn.client_id,
    document_type: "credit_note",
    source_invoice_id: cn.source_invoice_id,
    correction_reason: cn.correction_reason,
    issue_date: cn.issue_date,
    due_date: null,
    currency_code: cn.currency_code || "EUR",
    document_language: cn.document_language,
    notes: cn.notes,
    subtotal_ht: totals.subtotal_ht,
    total_vat: totals.total_vat,
    total_ttc: totals.total_ttc,
    seller_snapshot: sellerSnapshot as any,
    client_snapshot: clientSnapshot as any,
    legal_requirements_snapshot: (company?.legal_requirements ?? {}) as any,
    updated_by: userId,
  };

  let id = cn.id;
  if (id) {
    const { error } = await supabase.from("invoices").update(payload as any).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("invoices")
      .insert({ ...payload, status: "draft", created_by: userId } as any)
      .select("id").single();
    if (error) throw error;
    id = data.id;
  }

  // Replace lines (V1 strategy: deterministic + simple).
  await supabase.from("invoice_lines").delete().eq("invoice_id", id);
  if (lines.length) {
    const rows = lines.map((l, idx) => {
      const t = computeLine({ quantity: l.quantity, unit_price: l.unit_price, vat_rate: l.vat_rate });
      return {
        invoice_id: id!,
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

  return id!;
}

/**
 * Issue a draft credit note: claim AV number, set status=issued, freeze issue_date.
 * The DB cap-validation trigger fires under FOR UPDATE on the source invoice and
 * rejects with `credit_note_exceeds_source_total` if cumulative credits would
 * exceed the source invoice total.
 */
export async function issueCreditNote(tenantId: string, creditNoteId: string): Promise<string> {
  const today = new Date();
  const yyyy = today.getFullYear();
  const iso = today.toISOString().slice(0, 10);

  const { data: numData, error: numErr } = await supabase.rpc("claim_invoice_number", {
    _tenant_id: tenantId,
    _document_type: "credit_note" as Database["public"]["Enums"]["invoice_document_type"],
    _year: yyyy,
  });
  if (numErr) throw numErr;
  const number = numData as unknown as string;

  const { error } = await supabase
    .from("invoices")
    .update({
      status: "issued" as InvoiceStatus,
      invoice_number: number,
      issue_date: iso,
      issued_at: new Date().toISOString(),
    } as any)
    .eq("id", creditNoteId);
  if (error) throw error;
  return number;
}

export async function cancelCreditNote(creditNoteId: string): Promise<void> {
  const { error } = await supabase
    .from("invoices")
    .update({ status: "cancelled" as InvoiceStatus, cancelled_at: new Date().toISOString() } as any)
    .eq("id", creditNoteId);
  if (error) throw error;
}

/** Maximum amount that can still be credited on a source invoice (>= 0). */
export function creditableAmount(invoiceTotal: number, alreadyCredited: number): number {
  return Math.max(0, Math.round((invoiceTotal - alreadyCredited) * 100) / 100);
}
