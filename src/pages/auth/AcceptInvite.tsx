import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { acceptInvitation, lookupInvitation, type LookupResult } from "@/lib/team";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AcceptInvitePage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { session, user, loading, refresh, setCurrentTenantId } = useAuth();

  const [info, setInfo] = useState<LookupResult>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookingUp, setLookingUp] = useState(true);

  useEffect(() => {
    (async () => {
      if (!token) { setError("invalid"); setLookingUp(false); return; }
      try {
        const data = await lookupInvitation(token);
        setInfo(data);
        if (!data) setError("not_found");
      } catch {
        setError("not_found");
      } finally {
        setLookingUp(false);
      }
    })();
  }, [token]);

  const goAuth = (target: "sign-in" | "sign-up") => {
    const next = `/invite/${token}`;
    navigate(`/auth/${target}?next=${encodeURIComponent(next)}`);
  };

  const onAccept = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const tenantId = await acceptInvitation(token);
      await refresh();
      setCurrentTenantId(tenantId);
      toast.success(t("invite.toasts.joined"));
      navigate("/app", { replace: true });
    } catch (e: any) {
      const msg: string = e?.message ?? "";
      if (msg.includes("seat_limit_reached")) setError("seat_limit_reached");
      else if (msg.includes("invitation_email_mismatch")) setError("email_mismatch");
      else if (msg.includes("invitation_expired")) setError("expired");
      else if (msg.includes("invitation_revoked")) setError("revoked");
      else if (msg.includes("invitation_accepted")) setError("already_accepted");
      else setError("unknown");
    } finally {
      setBusy(false);
    }
  };

  if (loading || lookingUp) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10 bg-background">
      <div className="w-full max-w-md surface p-6">
        <div className="font-serif text-2xl mb-1">{t("invite.title")}</div>
        <p className="text-sm text-muted-foreground mb-5">{t("invite.subtitle")}</p>

        {error === "not_found" && <Message kind="error" text={t("invite.errors.notFound")} />}
        {error === "expired" && <Message kind="error" text={t("invite.errors.expired")} />}
        {error === "revoked" && <Message kind="error" text={t("invite.errors.revoked")} />}
        {error === "already_accepted" && <Message kind="info" text={t("invite.errors.alreadyAccepted")} />}
        {error === "email_mismatch" && info && (
          <Message kind="error" text={t("invite.errors.emailMismatch", { email: info.email })} />
        )}
        {error === "seat_limit_reached" && <Message kind="error" text={t("invite.errors.seatFull")} />}
        {error === "unknown" && <Message kind="error" text={t("invite.errors.unknown")} />}

        {!error && info && (
          <>
            <div className="rounded-md border border-border p-4 mb-5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("invite.workspace")}
              </div>
              <div className="font-serif text-lg mt-1">{info.tenant_name}</div>
              <div className="text-xs text-muted-foreground mt-2">
                {t("invite.invitedAs", { email: info.email })}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("invite.role")}: {t(`team.roles.${info.role}`, { defaultValue: info.role })}
              </div>
            </div>

            {!session ? (
              <div className="space-y-2">
                <p className="text-sm">{t("invite.needAuth")}</p>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => goAuth("sign-in")}>{t("auth.signIn")}</Button>
                  <Button variant="outline" className="flex-1" onClick={() => goAuth("sign-up")}>
                    {t("auth.signUp")}
                  </Button>
                </div>
              </div>
            ) : user?.email && info.email.toLowerCase() !== user.email.toLowerCase() ? (
              <Message kind="error" text={t("invite.errors.emailMismatch", { email: info.email })} />
            ) : (
              <Button className="w-full" onClick={onAccept} disabled={busy}>
                {busy ? t("common.loading") : t("invite.accept")}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Message({ kind, text }: { kind: "error" | "info"; text: string }) {
  return (
    <div className={`rounded-md border p-3 text-sm mb-4 ${kind === "error" ? "border-destructive/40 text-destructive bg-destructive/5" : "border-border text-muted-foreground"}`}>
      {text}
    </div>
  );
}
