import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Lock, Mail, MoreHorizontal, Shield, Trash2, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useEntitlements } from "@/hooks/use-entitlements";
import {
  createInvitation,
  inviteUrl,
  listInvitations,
  listMembers,
  removeMember,
  revokeInvitation,
  updateMemberRole,
  type Invitation,
  type Member,
} from "@/lib/team";
import { PageBody, PageHeader } from "@/components/layout/PageScaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  role: z.enum(["admin", "member"]),
});

export default function TeamPage() {
  const { t } = useTranslation();
  const { user, currentTenantId, memberships, refresh } = useAuth();
  const { snapshot, hasFeature, getLimit } = useEntitlements();

  const myRole = useMemo(
    () => memberships.find((m) => m.tenant_id === currentTenantId)?.role ?? null,
    [memberships, currentTenantId],
  );
  const canManage = myRole === "owner" || myRole === "admin";
  const inviteEnabled = hasFeature("users.invite");
  const seatLimit = getLimit("limit.max_users");

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [submitting, setSubmitting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);

  const reload = async () => {
    if (!currentTenantId) return;
    setLoading(true);
    try {
      const [m, i] = await Promise.all([listMembers(currentTenantId), listInvitations(currentTenantId)]);
      setMembers(m);
      setInvitations(i);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [currentTenantId]);

  const pendingCount = invitations.filter((i) => i.status === "pending").length;
  const usedSeats = members.length;
  const seatsFull = seatLimit !== null && usedSeats >= seatLimit;
  const projectedFull = seatLimit !== null && usedSeats + pendingCount >= seatLimit;

  const onCreateInvite = async () => {
    if (!currentTenantId || !user) return;
    const parsed = inviteSchema.safeParse({ email, role });
    if (!parsed.success) {
      toast.error(t("team.errors.invalidEmail"));
      return;
    }
    if (members.some((m) => (m.email ?? "").toLowerCase() === parsed.data.email)) {
      toast.error(t("team.errors.alreadyMember"));
      return;
    }
    setSubmitting(true);
    try {
      const { rawToken } = await createInvitation({
        tenantId: currentTenantId,
        email: parsed.data.email,
        role: parsed.data.role,
        invitedBy: user.id,
      });
      const link = inviteUrl(rawToken);
      setGeneratedLink(link);
      try { await navigator.clipboard.writeText(link); } catch { /* ignore */ }
      toast.success(t("team.toasts.inviteCreated"));
      setEmail("");
      setRole("member");
      await reload();
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("duplicate") || msg.includes("23505")) {
        toast.error(t("team.errors.alreadyInvited"));
      } else {
        toast.error(t("team.errors.inviteFailed"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onCopy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t("team.toasts.linkCopied"));
    } catch {
      toast.error(t("team.errors.copyFailed"));
    }
  };

  const onRevoke = async (inv: Invitation) => {
    try {
      await revokeInvitation(inv.id);
      toast.success(t("team.toasts.inviteRevoked"));
      await reload();
    } catch {
      toast.error(t("team.errors.revokeFailed"));
    }
  };

  const onRemoveMember = async () => {
    if (!removeTarget || !currentTenantId) return;
    try {
      await removeMember(currentTenantId, removeTarget.user_id);
      toast.success(t("team.toasts.memberRemoved"));
      setRemoveTarget(null);
      await reload();
      await refresh();
    } catch {
      toast.error(t("team.errors.removeFailed"));
    }
  };

  const onChangeRole = async (m: Member, nextRole: "admin" | "member") => {
    if (!currentTenantId) return;
    try {
      await updateMemberRole(currentTenantId, m.user_id, nextRole);
      toast.success(t("team.toasts.roleUpdated"));
      await reload();
    } catch {
      toast.error(t("team.errors.roleFailed"));
    }
  };

  const planCode = snapshot?.plan?.code ?? "—";

  return (
    <PageBody>
      <PageHeader
        title={t("team.title")}
        description={t("team.description")}
        actions={
          canManage && (
            <Button
              onClick={() => { setGeneratedLink(null); setInviteOpen(true); }}
              disabled={!inviteEnabled || seatsFull || projectedFull}
              className="gap-2"
            >
              <UserPlus className="h-4 w-4" />
              {t("team.actions.invite")}
            </Button>
          )
        }
      />

      {/* Seat summary */}
      <div className="surface p-5 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              {t("team.seats.title")}
            </div>
            <div className="font-serif text-2xl mt-1">
              {usedSeats}{seatLimit !== null ? ` / ${seatLimit}` : ""}{" "}
              <span className="text-sm text-muted-foreground font-sans">
                {t("team.seats.used")}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {t("team.seats.planNote", { plan: planCode })}
            </p>
          </div>
          <div className="text-right">
            {!inviteEnabled && (
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" />
                {t("team.seats.inviteDisabled")}
              </Badge>
            )}
            {inviteEnabled && seatsFull && (
              <Badge variant="destructive">{t("team.seats.full")}</Badge>
            )}
          </div>
        </div>
        {!inviteEnabled && (
          <p className="text-sm text-muted-foreground mt-3">
            {t("team.seats.upgradeNote")}
          </p>
        )}
      </div>

      {/* Members */}
      <div className="surface p-5 mb-6">
        <h2 className="font-serif text-lg mb-4">{t("team.members.title")}</h2>
        {loading ? (
          <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : members.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t("team.members.empty")}</div>
        ) : (
          <ul className="divide-y divide-border">
            {members.map((m) => {
              const isOwner = m.role === "owner";
              const isMe = m.user_id === user?.id;
              const canEdit = canManage && !isOwner && !isMe;
              return (
                <li key={m.user_id} className="py-3 flex flex-wrap items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-accent text-accent-foreground grid place-items-center text-xs font-semibold">
                    {(m.full_name || m.email || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {m.full_name || m.email || m.user_id}
                      {isMe && <span className="ml-2 text-xs text-muted-foreground">({t("team.members.you")})</span>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                  </div>
                  <Badge variant={isOwner ? "default" : "secondary"} className="capitalize">
                    {t(`team.roles.${m.role}`, { defaultValue: m.role })}
                  </Badge>
                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={t("team.actions.more")}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {m.role !== "admin" && (
                          <DropdownMenuItem onClick={() => onChangeRole(m, "admin")}>
                            <Shield className="h-4 w-4 mr-2" /> {t("team.actions.makeAdmin")}
                          </DropdownMenuItem>
                        )}
                        {m.role !== "member" && (
                          <DropdownMenuItem onClick={() => onChangeRole(m, "member")}>
                            <Users className="h-4 w-4 mr-2" /> {t("team.actions.makeMember")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive" onClick={() => setRemoveTarget(m)}>
                          <Trash2 className="h-4 w-4 mr-2" /> {t("team.actions.remove")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pending invitations */}
      <div className="surface p-5">
        <h2 className="font-serif text-lg mb-4">{t("team.invitations.title")}</h2>
        {invitations.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t("team.invitations.empty")}</div>
        ) : (
          <ul className="divide-y divide-border">
            {invitations.map((inv) => (
              <li key={inv.id} className="py-3 flex flex-wrap items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{inv.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {t(`team.roles.${inv.role}`, { defaultValue: inv.role })} ·{" "}
                    {t("team.invitations.expiresAt", { date: new Date(inv.expires_at).toLocaleDateString() })}
                  </div>
                </div>
                <Badge
                  variant={
                    inv.status === "pending" ? "secondary" :
                    inv.status === "accepted" ? "default" : "outline"
                  }
                >
                  {t(`team.statuses.${inv.status}`, { defaultValue: inv.status })}
                </Badge>
                {inv.status === "pending" && canManage && (
                  <Button variant="ghost" size="sm" onClick={() => onRevoke(inv)}>
                    {t("team.actions.revoke")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={(v) => { setInviteOpen(v); if (!v) setGeneratedLink(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("team.dialog.title")}</DialogTitle>
            <DialogDescription>{t("team.dialog.description")}</DialogDescription>
          </DialogHeader>

          {!generatedLink ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">{t("team.dialog.email")}</Label>
                <Input
                  id="invite-email" type="email" autoComplete="off"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com" maxLength={255}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">{t("team.dialog.role")}</Label>
                <Select value={role} onValueChange={(v) => setRole(v as "admin" | "member")}>
                  <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">{t("team.roles.member")}</SelectItem>
                    <SelectItem value="admin">{t("team.roles.admin")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("team.dialog.linkReady")}</p>
              <div className="flex items-center gap-2">
                <Input readOnly value={generatedLink} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => onCopy(generatedLink)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("team.dialog.linkHint")}</p>
            </div>
          )}

          <DialogFooter>
            {!generatedLink ? (
              <>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>{t("common.cancel")}</Button>
                <Button onClick={onCreateInvite} disabled={submitting || !email}>
                  {submitting ? t("common.loading") : t("team.dialog.send")}
                </Button>
              </>
            ) : (
              <Button onClick={() => setInviteOpen(false)}>{t("common.done", { defaultValue: "Done" })}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove member confirm */}
      <AlertDialog open={!!removeTarget} onOpenChange={(v) => { if (!v) setRemoveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("team.remove.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("team.remove.description", { name: removeTarget?.full_name || removeTarget?.email || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onRemoveMember}>{t("team.remove.confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageBody>
  );
}
