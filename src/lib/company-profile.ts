/**
 * Company Profile data layer (V1)
 * --------------------------------
 * Single shared load/save for the tenant's primary company profile.
 * Both the Company page and any onboarding step MUST use this layer
 * — never duplicate save logic in two places.
 *
 * Persists `legal_requirements` snapshot via the country-pack resolver
 * so UI components only READ structured requirements; they never
 * re-derive France rules locally.
 */
import { supabase } from "@/integrations/supabase/client";
import { resolveRequirements, type CompanyProfileInput, type LegalRequirements } from "@/lib/required-invoice-logic";
import type { Database } from "@/integrations/supabase/types";

export type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];

export type PaymentDefaults = {
  iban?: string;
  bic?: string;
  payment_terms_days?: number;
  payment_instructions?: string;
};

export type InvoiceDefaults = {
  currency?: string;
};

export type CompanyFormValues = {
  // branding
  logo_url: string | null;
  signature_url: string | null;
  // identity
  company_name: string;
  legal_name: string | null;
  legal_entity_type: "individual" | "company";
  fr_legal_form: CompanyRow["fr_legal_form"];
  fr_seller_profile: CompanyRow["fr_seller_profile"];
  // registration / tax
  siren: string | null;
  siret: string | null;
  vat_regime: CompanyRow["vat_regime"];
  vat_number: string | null;
  // contact
  email: string | null;
  phone: string | null;
  website: string | null;
  // address
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country_code: "FR";
  // document defaults
  default_document_language: "fr" | "en" | "ru";
  // payment
  payment_defaults: PaymentDefaults;
  invoice_defaults: InvoiceDefaults;
  regulated_activity_flags: Record<string, boolean>;
};

export const EMPTY_FORM: CompanyFormValues = {
  logo_url: null,
  signature_url: null,
  company_name: "",
  legal_name: "",
  legal_entity_type: "individual",
  fr_legal_form: null,
  fr_seller_profile: null,
  siren: "",
  siret: "",
  vat_regime: "franchise_base",
  vat_number: "",
  email: "",
  phone: "",
  website: "",
  address_line1: "",
  address_line2: "",
  postal_code: "",
  city: "",
  country_code: "FR",
  default_document_language: "fr",
  payment_defaults: { payment_terms_days: 30 },
  invoice_defaults: { currency: "EUR" },
  regulated_activity_flags: {},
};

export function rowToForm(row: CompanyRow): CompanyFormValues {
  const pd = (row.payment_defaults ?? {}) as PaymentDefaults;
  const id = (row.invoice_defaults ?? {}) as InvoiceDefaults;
  const flags = (row.regulated_activity_flags ?? {}) as Record<string, boolean>;
  return {
    logo_url: row.logo_url ?? null,
    signature_url: (row as any).signature_url ?? null,
    company_name: row.company_name ?? "",
    legal_name: row.legal_name ?? "",
    legal_entity_type: row.legal_entity_type,
    fr_legal_form: row.fr_legal_form,
    fr_seller_profile: row.fr_seller_profile,
    siren: row.siren ?? "",
    siret: row.siret ?? "",
    vat_regime: row.vat_regime,
    vat_number: row.vat_number ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    website: (row as any).website ?? "",
    address_line1: row.address_line1 ?? "",
    address_line2: row.address_line2 ?? "",
    postal_code: row.postal_code ?? "",
    city: row.city ?? "",
    country_code: "FR",
    default_document_language: row.default_document_language,
    payment_defaults: pd,
    invoice_defaults: id,
    regulated_activity_flags: flags,
  };
}

export function deriveRequirements(v: CompanyFormValues): LegalRequirements {
  const input: CompanyProfileInput = {
    country_code: v.country_code,
    legal_entity_type: v.legal_entity_type,
    fr_legal_form: v.fr_legal_form,
    fr_seller_profile: v.fr_seller_profile,
    vat_regime: v.vat_regime,
    has_siren: !!v.siren,
    has_vat_number: !!v.vat_number,
    regulated_activity_flags: v.regulated_activity_flags,
  };
  return resolveRequirements(input);
}

export async function loadPrimaryCompany(tenantId: string): Promise<CompanyRow | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_primary", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function savePrimaryCompany(
  tenantId: string,
  values: CompanyFormValues,
  existingId: string | null
): Promise<CompanyRow> {
  const requirements = deriveRequirements(values);
  const payload = {
    tenant_id: tenantId,
    is_primary: true,
    logo_url: values.logo_url,
    signature_url: values.signature_url,
    company_name: values.company_name.trim(),
    legal_name: values.legal_name?.trim() || null,
    legal_entity_type: values.legal_entity_type,
    fr_legal_form: values.fr_legal_form,
    fr_seller_profile: values.fr_seller_profile,
    siren: values.siren?.trim() || null,
    siret: values.siret?.trim() || null,
    vat_regime: values.vat_regime,
    vat_number: values.vat_number?.trim() || null,
    email: values.email?.trim() || null,
    phone: values.phone?.trim() || null,
    website: values.website?.trim() || null,
    address_line1: values.address_line1?.trim() || null,
    address_line2: values.address_line2?.trim() || null,
    postal_code: values.postal_code?.trim() || null,
    city: values.city?.trim() || null,
    country_code: "FR" as const,
    default_document_language: values.default_document_language,
    payment_defaults: values.payment_defaults as any,
    invoice_defaults: values.invoice_defaults as any,
    regulated_activity_flags: values.regulated_activity_flags as any,
    legal_requirements: requirements as any,
  };

  if (existingId) {
    const { data, error } = await supabase
      .from("companies")
      .update(payload as any)
      .eq("id", existingId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from("companies")
    .insert(payload as any)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ---------- Validation (V1, deliberately light) ----------
const SIREN_RE = /^\d{9}$/;
const SIRET_RE = /^\d{14}$/;
const VAT_FR_RE = /^FR[0-9A-Z]{2}\d{9}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldErrors = Partial<Record<keyof CompanyFormValues, string>>;

export function validate(v: CompanyFormValues, required: string[]): FieldErrors {
  const e: FieldErrors = {};
  if (!v.company_name.trim()) e.company_name = "required";
  if (required.includes("address_line1") && !v.address_line1?.trim()) e.address_line1 = "required";
  if (required.includes("postal_code") && !v.postal_code?.trim()) e.postal_code = "required";
  if (required.includes("city") && !v.city?.trim()) e.city = "required";
  if (required.includes("siren")) {
    if (!v.siren?.trim()) e.siren = "required";
    else if (!SIREN_RE.test(v.siren.replace(/\s/g, ""))) e.siren = "format";
  } else if (v.siren && !SIREN_RE.test(v.siren.replace(/\s/g, ""))) {
    e.siren = "format";
  }
  if (v.siret && !SIRET_RE.test(v.siret.replace(/\s/g, ""))) e.siret = "format";
  if (required.includes("vat_number") && !v.vat_number?.trim()) e.vat_number = "required";
  if (v.vat_number && !VAT_FR_RE.test(v.vat_number.replace(/\s/g, ""))) e.vat_number = "format";
  if (v.email && !EMAIL_RE.test(v.email)) e.email = "format";
  return e;
}
