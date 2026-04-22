/**
 * Payments data layer — tenant-scoped manual payment recording.
 * Status transitions (paid/issued) are handled by a DB trigger so the UI
 * never has to compute or race the invoice status.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PaymentMethod =
  | "bank_transfer" | "card" | "cash" | "check" | "paypal" | "stripe" | "other";

export type PaymentRow = {
  id: string;
  tenant_id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  method: PaymentMethod;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type NewPayment = {
  payment_date: string;       // YYYY-MM-DD
  amount: number;
  method: PaymentMethod;
  note?: string | null;
};

export async function listPayments(invoiceId: string): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from("invoice_payments" as any)
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("payment_date", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown) as PaymentRow[];
}

export async function recordPayment(
  tenantId: string,
  invoiceId: string,
  userId: string | null,
  p: NewPayment,
): Promise<PaymentRow> {
  const { data, error } = await supabase
    .from("invoice_payments" as any)
    .insert({
      tenant_id: tenantId,
      invoice_id: invoiceId,
      payment_date: p.payment_date,
      amount: p.amount,
      method: p.method,
      note: p.note ?? null,
      created_by: userId,
    })
    .select("*").single();
  if (error) throw error;
  return (data as unknown) as PaymentRow;
}

export async function deletePayment(paymentId: string): Promise<void> {
  const { error } = await supabase
    .from("invoice_payments" as any)
    .delete().eq("id", paymentId);
  if (error) throw error;
}

/**
 * Computed visible status. Applies "overdue" on top of stored status, and
 * treats `paid_amount + credited_amount >= total_ttc` as fully settled (paid).
 * `credited_amount` defaults to 0 to keep existing call sites working.
 */
export function computeVisibleStatus(
  status: Database["public"]["Enums"]["invoice_status"],
  due_date: string | null,
  paid_amount: number,
  total_ttc: number,
  credited_amount: number = 0,
): Database["public"]["Enums"]["invoice_status"] {
  if (status !== "issued") return status;
  const settled = paid_amount + credited_amount;
  if (settled >= total_ttc && total_ttc > 0) return "paid";
  if (!due_date) return "issued";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(due_date); due.setHours(0, 0, 0, 0);
  if (due < today) return "overdue";
  return "issued";
}

/** Remaining due, considering both payments and credit notes. */
export function balanceDue(total_ttc: number, paid_amount: number, credited_amount: number = 0): number {
  return Math.max(0, Math.round((total_ttc - paid_amount - credited_amount) * 100) / 100);
}
