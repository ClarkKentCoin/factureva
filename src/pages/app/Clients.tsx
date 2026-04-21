import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Archive, ArchiveRestore, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageBody, PageHeader, EmptyState } from "@/components/layout/PageScaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const CLIENT_TYPES = ["company", "individual"] as const;
type ClientType = (typeof CLIENT_TYPES)[number];

type Client = {
  id: string;
  tenant_id: string;
  client_type: ClientType;
  display_name: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country_code: "FR";
  vat_number: string | null;
  notes: string | null;
  is_active: boolean;
};

const schema = z.object({
  client_type: z.enum(CLIENT_TYPES),
  display_name: z.string().trim().min(1).max(160),
  legal_name: z.string().trim().max(160).optional().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  address_line1: z.string().trim().max(200).optional().or(z.literal("")),
  address_line2: z.string().trim().max(200).optional().or(z.literal("")),
  postal_code: z.string().trim().max(20).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  vat_number: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  is_active: z.boolean(),
});
type FormData = z.infer<typeof schema>;

const emptyForm: FormData = {
  client_type: "company", display_name: "", legal_name: "",
  email: "", phone: "",
  address_line1: "", address_line2: "", postal_code: "", city: "",
  vat_number: "", notes: "", is_active: true,
};

export default function ClientsPage() {
  const { t } = useTranslation();
  const { currentTenantId } = useAuth();
  const [rows, setRows] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");

  const load = async () => {
    if (!currentTenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("tenant_id", currentTenantId)
      .order("created_at", { ascending: false });
    if (error) toast.error(t("common.loadError"));
    else setRows((data ?? []) as Client[]);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [currentTenantId]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) =>
      r.display_name.toLowerCase().includes(s) ||
      (r.legal_name ?? "").toLowerCase().includes(s) ||
      (r.email ?? "").toLowerCase().includes(s) ||
      (r.city ?? "").toLowerCase().includes(s)
    );
  }, [rows, q]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({
      client_type: c.client_type, display_name: c.display_name,
      legal_name: c.legal_name ?? "", email: c.email ?? "", phone: c.phone ?? "",
      address_line1: c.address_line1 ?? "", address_line2: c.address_line2 ?? "",
      postal_code: c.postal_code ?? "", city: c.city ?? "",
      vat_number: c.vat_number ?? "", notes: c.notes ?? "",
      is_active: c.is_active,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!currentTenantId) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(t("company.toasts.invalid")); return; }
    setSaving(true);
    const payload = {
      tenant_id: currentTenantId,
      client_type: parsed.data.client_type,
      display_name: parsed.data.display_name,
      legal_name: parsed.data.legal_name || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address_line1: parsed.data.address_line1 || null,
      address_line2: parsed.data.address_line2 || null,
      postal_code: parsed.data.postal_code || null,
      city: parsed.data.city || null,
      country_code: "FR" as const,
      vat_number: parsed.data.vat_number || null,
      notes: parsed.data.notes || null,
      is_active: parsed.data.is_active,
    };
    const res = editing
      ? await supabase.from("clients").update(payload).eq("id", editing.id)
      : await supabase.from("clients").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(t("common.saveError")); return; }
    toast.success(t("common.saved"));
    setOpen(false);
    void load();
  };

  const toggleArchive = async (c: Client) => {
    const { error } = await supabase
      .from("clients").update({ is_active: !c.is_active }).eq("id", c.id);
    if (error) toast.error(t("common.saveError"));
    else { toast.success(c.is_active ? t("common.archived") : t("common.restored")); void load(); }
  };

  return (
    <PageBody>
      <PageHeader
        title={t("clients.title")}
        description={t("clients.description")}
        actions={
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" />{t("clients.new")}
          </Button>
        }
      />

      {rows.length > 0 && (
        <div className="mb-4 relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={t("clients.searchPlaceholder")} className="pl-9"
          />
        </div>
      )}

      {loading ? (
        <div className="surface p-6 text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t("clients.emptyTitle")}
          description={t("clients.emptyDescription")}
          action={<Button onClick={openNew}>{t("clients.new")}</Button>}
        />
      ) : (
        <div className="surface divide-y divide-border">
          {filtered.map((c) => (
            <div key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium truncate">{c.display_name}</div>
                  <Badge variant="secondary">{t(`clients.type.${c.client_type}`)}</Badge>
                  {!c.is_active && <Badge variant="outline">{t("common.inactive")}</Badge>}
                </div>
                {c.legal_name && c.legal_name !== c.display_name && (
                  <div className="text-sm text-muted-foreground mt-0.5 truncate">{c.legal_name}</div>
                )}
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                  {c.email && <span>{c.email}</span>}
                  {c.phone && <span>{c.phone}</span>}
                  {c.city && <span>{c.postal_code} {c.city}</span>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => openEdit(c)} className="gap-1">
                  <Pencil className="h-4 w-4" />{t("common.edit")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleArchive(c)} className="gap-1">
                  {c.is_active
                    ? (<><Archive className="h-4 w-4" />{t("common.archive")}</>)
                    : (<><ArchiveRestore className="h-4 w-4" />{t("common.restore")}</>)}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t("clients.edit") : t("clients.new")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>{t("clients.fields.client_type")}</Label>
              <Select value={form.client_type} onValueChange={(v) => setForm({ ...form, client_type: v as ClientType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLIENT_TYPES.map((c) => (
                    <SelectItem key={c} value={c}>{t(`clients.type.${c}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("clients.fields.display_name")}</Label>
              <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </div>
            {form.client_type === "company" && (
              <div className="sm:col-span-2">
                <Label>{t("clients.fields.legal_name")}</Label>
                <Input value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
              </div>
            )}
            <div>
              <Label>{t("clients.fields.email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>{t("clients.fields.phone")}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("clients.fields.address_line1")}</Label>
              <Input value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("clients.fields.address_line2")}</Label>
              <Input value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} />
            </div>
            <div>
              <Label>{t("clients.fields.postal_code")}</Label>
              <Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
            </div>
            <div>
              <Label>{t("clients.fields.city")}</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("clients.fields.vat_number")}</Label>
              <Input value={form.vat_number} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("clients.fields.notes")}</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label className="cursor-pointer">{t("clients.fields.is_active")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={submit} disabled={saving}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
