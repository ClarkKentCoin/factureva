import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AuthLayout } from "@/components/layout/AuthLayout";

export default function SignIn() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    // GuestOnly + PostLoginRedirect on `/` will route correctly:
    // super_admin → /superadmin, tenant user → /app, no tenant → /onboarding.
    nav("/post-login", { replace: true });
  };

  return (
    <AuthLayout
      title={t("auth.welcome")}
      subtitle={t("app.tagline")}
      footer={<>{t("auth.noAccount")} <Link to="/auth/sign-up" className="text-accent underline-offset-2 hover:underline">{t("auth.signUp")}</Link></>}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t("common.loading") : t("auth.signIn")}
        </Button>
      </form>
    </AuthLayout>
  );
}
