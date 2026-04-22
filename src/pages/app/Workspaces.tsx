import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Plus, Archive, ArchiveRestore, Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageBody, PageHeader } from "@/components/layout/PageScaffold";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function WorkspacesPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const { memberships, currentTenantId, setCurrentTenantId, refresh } = useAuth();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (params.get("new") === "1") {
      setShowCreate(true);
      params.delete("new");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<{ id: string; name: string } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<{ id: string; name: string } | null>(null);

  const create = async () => {
    if (busy || !newName.trim()) return;
    setBusy(true);
    const { data: tid, error } = await supabase.rpc("create_initial_tenant", { _name: newName.trim() });
    setBusy(false);
    if (error || !tid) return toast.error(error?.message ?? "Error");
    setCurrentTenantId(tid as string);
    setNewName("");
    setShowCreate(false);
    await refresh();
    toast.success(t("workspaces.toasts.created"));
    nav("/app");
  };

  const rename = async () => {
    if (!editing || busy || !editing.name.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("tenants")
      .update({ name: editing.name.trim() })
      .eq("id", editing.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    setEditing(null);
    await refresh();
    toast.success(t("workspaces.toasts.renamed"));
  };

  const archive = async () => {
    if (!confirmArchive || busy) return;
    setBusy(true);
    const { error } = await supabase
      .from("tenants")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", confirmArchive.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    // If we just archived the active workspace, switch to another one if any.
    if (currentTenantId === confirmArchive.id) {
      const next = memberships.find((m) => m.tenant_id !== confirmArchive.id && !m.tenant?.archived_at);
      setCurrentTenantId(next?.tenant_id ?? null);
    }
    setConfirmArchive(null);
    await refresh();
    toast.success(t("workspaces.toasts.archived"));
  };

  const restore = async () => {
    if (!confirmRestore || busy) return;
    setBusy(true);
    const { error } = await supabase
      .from("tenants")
      .update({ archived_at: null })
      .eq("id", confirmRestore.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    setConfirmRestore(null);
    await refresh();
    toast.success(t("workspaces.toasts.restored"));
  };

  const sorted = [...memberships].sort((a, b) =>
    Number(!!a.tenant?.archived_at) - Number(!!b.tenant?.archived_at) ||
    (a.tenant?.name ?? "").localeCompare(b.tenant?.name ?? "")
  );

  return (
    <PageBody>
      <PageHeader
        title={t("workspaces.title")}
        description={t("workspaces.description")}
        actions={
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("workspaces.create")}
          </Button>
        }
      />

      <div className="space-y-2">
        {sorted.map((m) => {
          const isCurrent = m.tenant_id === currentTenantId;
          const isArchived = !!m.tenant?.archived_at;
          const isOwner = m.role === "owner";
          return (
            <div
              key={m.tenant_id}
              className="surface flex items-center gap-3 px-4 py-3"
            >
              <div className="h-9 w-9 rounded-md bg-accent text-accent-foreground grid place-items-center text-sm font-semibold">
                {m.tenant?.name?.[0]?.toUpperCase() ?? "·"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium truncate">{m.tenant?.name ?? "—"}</div>
                  <Badge variant="outline" className="capitalize">{m.role}</Badge>
                  {isCurrent && (
                    <Badge className="gap-1"><Check className="h-3 w-3" />{t("workspaces.current")}</Badge>
                  )}
                  {isArchived && (
                    <Badge variant="secondary">{t("workspaces.archivedBadge")}</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isArchived && !isCurrent && (
                  <Button size="sm" variant="outline" onClick={() => { setCurrentTenantId(m.tenant_id); toast.success(t("workspaces.toasts.switched")); }}>
                    {t("workspaces.switch")}
                  </Button>
                )}
                {isOwner && !isArchived && (
                  <>
                    <Button size="icon" variant="ghost" aria-label={t("workspaces.rename")}
                      onClick={() => setEditing({ id: m.tenant_id, name: m.tenant?.name ?? "" })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={t("workspaces.archive")}
                      onClick={() => setConfirmArchive({ id: m.tenant_id, name: m.tenant?.name ?? "" })}>
                      <Archive className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {isOwner && isArchived && (
                  <Button size="sm" variant="outline" className="gap-2"
                    onClick={() => setConfirmRestore({ id: m.tenant_id, name: m.tenant?.name ?? "" })}>
                    <ArchiveRestore className="h-4 w-4" />
                    {t("workspaces.restore")}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("workspaces.createTitle")}</DialogTitle>
            <DialogDescription>{t("workspaces.createDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ws-name">{t("onboarding.workspaceName")}</Label>
            <Input id="ws-name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t("common.cancel")}</Button>
            <Button onClick={create} disabled={busy || !newName.trim()}>
              {busy ? t("common.loading") : t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("workspaces.renameTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ws-rename">{t("onboarding.workspaceName")}</Label>
            <Input
              id="ws-rename"
              value={editing?.name ?? ""}
              onChange={(e) => setEditing((cur) => (cur ? { ...cur, name: e.target.value } : cur))}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
            <Button onClick={rename} disabled={busy || !editing?.name.trim()}>
              {busy ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive confirm */}
      <AlertDialog open={!!confirmArchive} onOpenChange={(o) => !o && setConfirmArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workspaces.archiveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("workspaces.archiveConfirm", { name: confirmArchive?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={archive}>{t("workspaces.archive")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore confirm */}
      <AlertDialog open={!!confirmRestore} onOpenChange={(o) => !o && setConfirmRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workspaces.restoreTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("workspaces.restoreConfirm", { name: confirmRestore?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={restore}>{t("workspaces.restore")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageBody>
  );
}
