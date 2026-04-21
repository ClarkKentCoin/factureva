/**
 * France Company Profile -> Required Invoice Logic
 * --------------------------------------------------
 * This module is the architectural seam that — given a company profile —
 * derives WHICH fields, mentions and behaviors are required on invoices/devis.
 *
 * Design principles:
 * - Pure, deterministic, no UI imports. Country packs can register their own resolver.
 * - Output is a `LegalRequirements` snapshot stored on `companies.legal_requirements`
 *   (jsonb) and re-evaluated when the company profile changes.
 * - UI components READ this snapshot. They never re-derive French rules locally.
 * - The full rule engine is intentionally NOT implemented yet; this file pins the
 *   types and a placeholder resolver so future work can plug in cleanly.
 */

export type CountryCode = "FR";
export type DocumentLanguage = "fr" | "en" | "ru";

export type FrLegalForm =
  | "micro_entrepreneur" | "ei" | "eirl" | "eurl" | "sarl"
  | "sas" | "sasu" | "sa" | "sci" | "association" | "other";

export type FrSellerProfile =
  | "micro_bnc" | "micro_bic_services" | "micro_bic_goods"
  | "reel_simplifie" | "reel_normal" | "franchise_base_tva" | "other";

export type VatRegime = "franchise_base" | "reel_simplifie" | "reel_normal" | "not_applicable";

export interface CompanyProfileInput {
  country_code: CountryCode;
  legal_entity_type: "individual" | "company";
  fr_legal_form?: FrLegalForm | null;
  fr_seller_profile?: FrSellerProfile | null;
  vat_regime: VatRegime;
  has_siren?: boolean;
  has_vat_number?: boolean;
  regulated_activity_flags?: Record<string, boolean>;
}

export interface LegalRequirements {
  country_code: CountryCode;
  required_company_fields: string[];     // e.g. ['siren','address_line1','postal_code']
  required_invoice_fields: string[];     // e.g. ['issue_date','due_date','total_ht','total_ttc']
  derived_invoice_fields: string[];      // values auto-filled from company (e.g. seller block)
  legal_mentions: { key: string; reason: string }[];
  vat_behavior: "charge_vat" | "no_vat_franchise_base" | "reverse_charge" | "not_applicable";
  notes: string[];
}

/** Default no-op snapshot for non-FR or unknown setups. */
export const EMPTY_REQUIREMENTS: LegalRequirements = {
  country_code: "FR",
  required_company_fields: [],
  required_invoice_fields: [],
  derived_invoice_fields: [],
  legal_mentions: [],
  vat_behavior: "not_applicable",
  notes: [],
};

/**
 * Placeholder France resolver. Intentionally minimal: ships only the universally
 * required fields and the franchise-base mention. The full rule matrix
 * (VAT thresholds, micro variants, regulated activities, mediation clauses, etc.)
 * will be added in the next step backed by `legal_phrases` rows.
 */
export function resolveFrRequirements(p: CompanyProfileInput): LegalRequirements {
  const required_company_fields = [
    "company_name",
    "address_line1",
    "postal_code",
    "city",
  ];

  // SIREN required for nearly every French seller; placeholder simplification.
  if (p.legal_entity_type === "company" || p.fr_legal_form === "micro_entrepreneur") {
    required_company_fields.push("siren");
  }

  const legal_mentions: { key: string; reason: string }[] = [];
  let vat_behavior: LegalRequirements["vat_behavior"] = "charge_vat";

  if (p.vat_regime === "franchise_base") {
    vat_behavior = "no_vat_franchise_base";
    legal_mentions.push({
      key: "tva_non_applicable_art293B",
      reason: "Franchise en base de TVA (art. 293 B du CGI)",
    });
  }

  if (p.vat_regime === "reel_simplifie" || p.vat_regime === "reel_normal") {
    required_company_fields.push("vat_number");
  }

  const required_invoice_fields = [
    "number", "issue_date", "due_date",
    "client_block", "seller_block",
    "lines", "total_ht", "total_tva", "total_ttc",
  ];

  const derived_invoice_fields = ["seller_block", "vat_mentions", "payment_terms"];

  return {
    country_code: "FR",
    required_company_fields,
    required_invoice_fields,
    derived_invoice_fields,
    legal_mentions,
    vat_behavior,
    notes: [
      "Placeholder resolver — full rule matrix to be implemented in next step.",
    ],
  };
}

export function resolveRequirements(p: CompanyProfileInput): LegalRequirements {
  if (p.country_code === "FR") return resolveFrRequirements(p);
  return EMPTY_REQUIREMENTS;
}
