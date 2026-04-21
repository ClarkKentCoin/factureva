import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { setInterfaceLanguage } from "@/lib/i18n";
import { AuthLayout } from "@/components/layout/AuthLayout";

/**
 * Onboarding (foundation, partially wired):
 *  Step 1 — create tenant/workspace          [implemented]
 *  Step 2 — choose interface language        [implemented]
 *  Step 3 — company profile                  [scaffolded — full form in next step]
 *
 * Architecture: each step writes its own slice; no step is "blocking" the data model.
 */
export default function Onboarding() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const { user, refresh, setCurrentTenantId } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [workspaceName, setWorkspaceName] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const createWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: tenant, error } = await supabase
      .from("tenants")
      .insert({
        name: workspaceName,
        created_by: user.id,
        default_country: "FR",
        default_document_language: "fr",
      })
      .select()
      .single();

    if (error || !tenant) { setLoading(false); return toast.error(error?.message ?? "Erreur"); }

    const { error: memErr } = await supabase
      .from("tenant_members")
      .insert({ tenant_id: tenant.id, user_id: user.id, role: "owner" });

    // Subscribe tenant to free plan by default
    const { data: freePlan } = await supabase
      .from("plans").select("id").eq("code", "free").single();
    if (freePlan) {
      await supabase.from("tenant_subscriptions").insert({
        tenant_id: tenant.id, plan_id: freePlan.id, status: "active",
      });
    }

    setLoading(false);
    if (memErr) return toast.error(memErr.message);

    setCurrentTenantId(tenant.id);
    await refresh();
    setStep(2);
  };

  const langs: { code: "fr" | "en" | "ru"; label: string }[] = [
    { code: "fr", label: "Français" },
    { code: "en", label: "English" },
    { code: "ru", label: "Русский" },
  ];

  return (
    <AuthLayout title={t("onboarding.title")} subtitle={`${t("onboarding.step" + step as any)}`}>
      {step === 1 && (
        <form onSubmit={createWorkspace} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ws">{t("onboarding.workspaceName")}</Label>
            <Input id="ws" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !workspaceName.trim()}>
            {loading ? t("common.loading") : t("onboarding.continue")}
          </Button>
        </form>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("onboarding.step2")}</p>
          <div className="grid gap-2">
            {langs.map((l) => (
              <button
                key={l.code}
                onClick={() => setInterfaceLanguage(l.code)}
                className={`surface px-4 py-3 text-left hover:bg-muted transition ${
                  i18n.language === l.code ? "ring-2 ring-accent" : ""
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <Button className="w-full" onClick={() => setStep(3)}>{t("onboarding.continue")}</Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("onboarding.step3")}</p>
          <div className="surface p-4 text-sm text-muted-foreground">
            {t("common.comingSoon")} — {t("onboarding.companyProfileNote")}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => nav("/app")}>
              {t("onboarding.skip")}
            </Button>
            <Button className="flex-1" onClick={() => nav("/app/company")}>
              {t("onboarding.continue")}
            </Button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
