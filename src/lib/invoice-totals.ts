/**
 * Deterministic invoice totals (V1).
 * Money rounded to 2 decimals using half-up. No advanced tax engine yet,
 * but the model is ready for per-line + per-rate aggregation later.
 */
export type LineInput = {
  quantity: number;
  unit_price: number;
  vat_rate: number; // percent, e.g. 20
};

export type LineTotals = {
  line_subtotal_ht: number;
  line_vat_amount: number;
  line_total_ttc: number;
};

export type InvoiceTotals = {
  subtotal_ht: number;
  total_vat: number;
  total_ttc: number;
};

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeLine(l: LineInput): LineTotals {
  const ht = round2((l.quantity || 0) * (l.unit_price || 0));
  const vat = round2(ht * ((l.vat_rate || 0) / 100));
  return { line_subtotal_ht: ht, line_vat_amount: vat, line_total_ttc: round2(ht + vat) };
}

export function computeInvoiceTotals(lines: LineInput[]): InvoiceTotals {
  let ht = 0, vat = 0;
  for (const l of lines) {
    const t = computeLine(l);
    ht += t.line_subtotal_ht;
    vat += t.line_vat_amount;
  }
  ht = round2(ht);
  vat = round2(vat);
  return { subtotal_ht: ht, total_vat: vat, total_ttc: round2(ht + vat) };
}

export function formatMoney(n: number, currency = "EUR", locale = "fr-FR") {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(n || 0);
  } catch {
    return `${(n || 0).toFixed(2)} ${currency}`;
  }
}
