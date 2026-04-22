import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Upload, Trash2 } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/PageScaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_FORM, type CompanyFormValues, type CompanyRow,
  deriveRequirements, loadPrimaryCompany, rowToForm, savePrimaryCompany, validate,
} from "@/lib/company-profile";

const FR_LEGAL_FORMS = [
  "micro_entrepreneur", "ei", "eirl", "eurl", "sarl",
  "sas", "sasu", "sa", "sci", "association", "other",
] as const;

const FR_SELLER_PROFILES = [
  "micro_bnc", "micro_bic_services", "micro_bic_goods",
  "reel_simplifie", "reel_normal", "franchise_base_tva", "other",
] as const;

const VAT_REGIMES = ["franchise_base", "reel_simplifie", "reel_normal", "not_applicable"] as const;
const DOC_LANGS = ["fr", "en", "ru"] as const;

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="surface p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="font-serif text-xl">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

function Field({
  id, label, required, error, children, hint, full,
}: {
  id: string; label: string; required?: boolean; error?: string; hint?: string;
  children: React.ReactNode; full?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={id}>
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default function CompanyPage() {
  const { t } = useTranslation();
  const { currentTenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<CompanyRow | null>(null);
  const [values, setValues] = useState<CompanyFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sigInputRef = useRef<HTMLInputElement | null>(null);

  const onLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !currentTenantId) return;
    if (!/^image\/(png|jpe?g|svg\+xml|webp)$/i.test(file.type)) {
      toast.error(t("company.toasts.logoType")); return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("company.toasts.logoSize")); return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${currentTenantId}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("company-logos").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("company-logos").getPublicUrl(path);
      setValues((p) => ({ ...p, logo_url: pub.publicUrl }));
      toast.success(t("company.toasts.logoUploaded"));
    } catch (err: any) {
      toast.error(err?.message || t("company.toasts.logoError"));
    } finally { setUploadingLogo(false); }
  };

  const onLogoRemove = () => {
    setValues((p) => ({ ...p, logo_url: null }));
  };

  const onSignatureFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !currentTenantId) return;
    if (!/^image\/(png|jpe?g|svg\+xml|webp)$/i.test(file.type)) {
      toast.error(t("company.toasts.signatureType")); return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("company.toasts.signatureSize")); return;
    }
    setUploadingSignature(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${currentTenantId}/company-signature-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("signatures").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("signatures").getPublicUrl(path);
      setValues((p) => ({ ...p, signature_url: pub.publicUrl }));
      toast.success(t("company.toasts.signatureUploaded"));
    } catch (err: any) {
      toast.error(err?.message || t("company.toasts.signatureError"));
    } finally { setUploadingSignature(false); }
  };

  const onSignatureRemove = () => {
    setValues((p) => ({ ...p, signature_url: null }));
  };

  useEffect(() => {
    let alive = true;
    if (!currentTenantId) return;
    setLoading(true);
    loadPrimaryCompany(currentTenantId)
      .then((row) => {
        if (!alive) return;
        setExisting(row);
        setValues(row ? rowToForm(row) : EMPTY_FORM);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [currentTenantId]);

  const requirements = useMemo(() => deriveRequirements(values), [values]);
  const required = requirements.required_company_fields;

  const set = <K extends keyof CompanyFormValues>(k: K, v: CompanyFormValues[K]) =>
    setValues((p) => ({ ...p, [k]: v }));

  const setPay = (k: keyof CompanyFormValues["payment_defaults"], v: any) =>
    setValues((p) => ({ ...p, payment_defaults: { ...p.payment_defaults, [k]: v } }));

  const errMsg = (k: string) => {
    const code = errors[k];
    if (!code) return undefined;
    return code === "required" ? t("company.errors.required") : t("company.errors.format");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenantId || saving) return;
    const v = validate(values, required);
    setErrors(v as Record<string, string>);
    if (Object.keys(v).length > 0) {
      toast.error(t("company.toasts.invalid"));
      return;
    }
    setSaving(true);
    try {
      const row = await savePrimaryCompany(currentTenantId, values, existing?.id ?? null);
      setExisting(row);
      setValues(rowToForm(row));
      toast.success(t("company.toasts.saved"));
    } catch (err: any) {
      toast.error(err.message ?? t("company.toasts.error"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageBody>
        <PageHeader title={t("company.title")} description={t("company.description")} />
        <div className="space-y-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title={t("company.title")}
        description={existing ? t("company.description") : t("company.emptyDescription")}
        actions={
          <Button form="company-form" type="submit" disabled={saving}>
            {saving ? t("common.loading") : t("common.save")}
          </Button>
        }
      />

      {requirements.legal_mentions.length > 0 && (
        <div className="surface p-4 mb-6 text-sm">
          <div className="font-medium mb-1">{t("company.legalMentionsTitle")}</div>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            {requirements.legal_mentions.map((m) => (
              <li key={m.key}>{m.reason}</li>
            ))}
          </ul>
        </div>
      )}

      <form id="company-form" onSubmit={onSubmit} className="space-y-6">
        <section className="surface p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="font-serif text-xl">{t("company.sections.logo")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t("company.sections.logoDesc")}</p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="h-20 w-32 rounded-md border border-border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
              {values.logo_url ? (
                <img src={values.logo_url} alt="logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("company.logo.empty")}</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden" onChange={onLogoFileChange} />
              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" disabled={uploadingLogo}
                  onClick={() => fileInputRef.current?.click()} className="gap-1">
                  <Upload className="h-4 w-4" />
                  {uploadingLogo ? t("common.loading") : (values.logo_url ? t("company.logo.replace") : t("company.logo.upload"))}
                </Button>
                {values.logo_url && (
                  <Button type="button" variant="ghost" size="sm" onClick={onLogoRemove} className="gap-1">
                    <Trash2 className="h-4 w-4" />{t("company.logo.remove")}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t("company.logo.hint")}</p>
            </div>
          </div>
        </section>

        <section className="surface p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="font-serif text-xl">{t("company.sections.signature")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t("company.sections.signatureDesc")}</p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="h-20 w-40 rounded-md border border-border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
              {values.signature_url ? (
                <img src={values.signature_url} alt="signature" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("company.signature.empty")}</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input ref={sigInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden" onChange={onSignatureFileChange} />
              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" disabled={uploadingSignature}
                  onClick={() => sigInputRef.current?.click()} className="gap-1">
                  <Upload className="h-4 w-4" />
                  {uploadingSignature ? t("common.loading") : (values.signature_url ? t("company.signature.replace") : t("company.signature.upload"))}
                </Button>
                {values.signature_url && (
                  <Button type="button" variant="ghost" size="sm" onClick={onSignatureRemove} className="gap-1">
                    <Trash2 className="h-4 w-4" />{t("company.signature.remove")}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t("company.signature.hint")}</p>
            </div>
          </div>
        </section>

        <Section title={t("company.sections.identity")} description={t("company.sections.identityDesc")}>
          <Field id="company_name" label={t("company.fields.company_name")} required error={errMsg("company_name")} full>
            <Input id="company_name" value={values.company_name}
              onChange={(e) => set("company_name", e.target.value)} />
          </Field>
          <Field id="legal_name" label={t("company.fields.legal_name")}>
            <Input id="legal_name" value={values.legal_name ?? ""} onChange={(e) => set("legal_name", e.target.value)} />
          </Field>
          <Field id="legal_entity_type" label={t("company.fields.legal_entity_type")} required>
            <Select value={values.legal_entity_type} onValueChange={(v) => set("legal_entity_type", v as any)}>
              <SelectTrigger id="legal_entity_type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">{t("company.entity.individual")}</SelectItem>
                <SelectItem value="company">{t("company.entity.company")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="fr_legal_form" label={t("company.fields.fr_legal_form")}>
            <Select value={values.fr_legal_form ?? "__"} onValueChange={(v) => set("fr_legal_form", v === "__" ? null : v as any)}>
              <SelectTrigger id="fr_legal_form"><SelectValue placeholder={t("company.notSelected")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__">{t("company.notSelected")}</SelectItem>
                {FR_LEGAL_FORMS.map((f) => (
                  <SelectItem key={f} value={f}>{t(`company.frLegalForm.${f}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="fr_seller_profile" label={t("company.fields.fr_seller_profile")}>
            <Select value={values.fr_seller_profile ?? "__"} onValueChange={(v) => set("fr_seller_profile", v === "__" ? null : v as any)}>
              <SelectTrigger id="fr_seller_profile"><SelectValue placeholder={t("company.notSelected")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__">{t("company.notSelected")}</SelectItem>
                {FR_SELLER_PROFILES.map((f) => (
                  <SelectItem key={f} value={f}>{t(`company.frSellerProfile.${f}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Section>

        <Section title={t("company.sections.tax")} description={t("company.sections.taxDesc")}>
          <Field id="siren" label={t("company.fields.siren")}
            required={required.includes("siren")} error={errMsg("siren")}
            hint={t("company.hints.siren")}>
            <Input id="siren" inputMode="numeric" value={values.siren ?? ""} onChange={(e) => set("siren", e.target.value)} />
          </Field>
          <Field id="siret" label={t("company.fields.siret")} error={errMsg("siret")} hint={t("company.hints.siret")}>
            <Input id="siret" inputMode="numeric" value={values.siret ?? ""} onChange={(e) => set("siret", e.target.value)} />
          </Field>
          <Field id="vat_regime" label={t("company.fields.vat_regime")} required>
            <Select value={values.vat_regime} onValueChange={(v) => set("vat_regime", v as any)}>
              <SelectTrigger id="vat_regime"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VAT_REGIMES.map((r) => (
                  <SelectItem key={r} value={r}>{t(`company.vatRegime.${r}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="vat_number" label={t("company.fields.vat_number")}
            required={required.includes("vat_number")} error={errMsg("vat_number")}
            hint={t("company.hints.vat_number")}>
            <Input id="vat_number" value={values.vat_number ?? ""} onChange={(e) => set("vat_number", e.target.value)} />
          </Field>
        </Section>

        <Section title={t("company.sections.contact")}>
          <Field id="email" label={t("company.fields.email")} error={errMsg("email")}>
            <Input id="email" type="email" value={values.email ?? ""} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field id="phone" label={t("company.fields.phone")}>
            <Input id="phone" value={values.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field id="website" label={t("company.fields.website")} full>
            <Input id="website" value={values.website ?? ""} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
          </Field>
        </Section>

        <Section title={t("company.sections.address")}>
          <Field id="address_line1" label={t("company.fields.address_line1")}
            required={required.includes("address_line1")} error={errMsg("address_line1")} full>
            <Input id="address_line1" value={values.address_line1 ?? ""} onChange={(e) => set("address_line1", e.target.value)} />
          </Field>
          <Field id="address_line2" label={t("company.fields.address_line2")} full>
            <Input id="address_line2" value={values.address_line2 ?? ""} onChange={(e) => set("address_line2", e.target.value)} />
          </Field>
          <Field id="postal_code" label={t("company.fields.postal_code")}
            required={required.includes("postal_code")} error={errMsg("postal_code")}>
            <Input id="postal_code" value={values.postal_code ?? ""} onChange={(e) => set("postal_code", e.target.value)} />
          </Field>
          <Field id="city" label={t("company.fields.city")}
            required={required.includes("city")} error={errMsg("city")}>
            <Input id="city" value={values.city ?? ""} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field id="country_code" label={t("company.fields.country_code")}>
            <Input id="country_code" value="France" disabled />
          </Field>
        </Section>

        <Section title={t("company.sections.documents")} description={t("company.sections.documentsDesc")}>
          <Field id="default_document_language" label={t("company.fields.default_document_language")}>
            <Select value={values.default_document_language} onValueChange={(v) => set("default_document_language", v as any)}>
              <SelectTrigger id="default_document_language"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_LANGS.map((l) => (
                  <SelectItem key={l} value={l}>{t(`company.docLang.${l}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="payment_terms_days" label={t("company.fields.payment_terms_days")}>
            <Input id="payment_terms_days" type="number" min={0} max={120}
              value={values.payment_defaults.payment_terms_days ?? ""}
              onChange={(e) => setPay("payment_terms_days", e.target.value ? Number(e.target.value) : undefined)} />
          </Field>
        </Section>

        <Section title={t("company.sections.payment")} description={t("company.sections.paymentDesc")}>
          <Field id="iban" label={t("company.fields.iban")}>
            <Input id="iban" value={values.payment_defaults.iban ?? ""} onChange={(e) => setPay("iban", e.target.value)} />
          </Field>
          <Field id="bic" label={t("company.fields.bic")}>
            <Input id="bic" value={values.payment_defaults.bic ?? ""} onChange={(e) => setPay("bic", e.target.value)} />
          </Field>
          <Field id="payment_instructions" label={t("company.fields.payment_instructions")} full>
            <Textarea id="payment_instructions" rows={3}
              value={values.payment_defaults.payment_instructions ?? ""}
              onChange={(e) => setPay("payment_instructions", e.target.value)} />
          </Field>
        </Section>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? t("common.loading") : t("common.save")}
          </Button>
        </div>
      </form>
    </PageBody>
  );
}
