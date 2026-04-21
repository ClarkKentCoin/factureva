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

const ITEM_TYPES = ["service", "good", "mixed"] as const;
type ItemType = (typeof ITEM_TYPES)[number];

type Item = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  item_type: ItemType;
  activity_id: string | null;
  default_unit: string | null;
  default_unit_price: number | null;
  default_vat_rate: number | null;
  accounting_category: string | null;
  is_active: boolean;
  created_at: string;
};

type ActivityLite = { id: string; name: string };

const NO_ACTIVITY = "__none__";

const schema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  item_type: z.enum(ITEM_TYPES),
  activity_id: z.string().nullable(),
  default_unit: z.string().trim().max(40).optional().or(z.literal("")),
  default_unit_price: z.number().min(0).max(99999999).nullable(),
  default_vat_rate: z.number().min(0).max(100).nullable(),
  accounting_category: z.string().trim().max(80).optional().or(z.literal("")),
  is_active: z.boolean(),
});
type FormData = z.infer<typeof schema>;

const emptyForm: FormData = {
  name: "", description: "", item_type: "service", activity_id: null,
  default_unit: "unit", default_unit_price: 0, default_vat_rate: 20,
  accounting_category: "", is_active: true,
};

export default function ItemsPage() {
  const { t } = useTranslation();
  const { currentTenantId } = useAuth();
  const [rows, setRows] = useState<Item[]>([]);
  const [activities, setActivities] = useState<ActivityLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");

  const load = async () => {
    if (!currentTenantId) return;
    setLoading(true);
    const [itemsRes, actsRes] = await Promise.all([
      supabase.from("items").select("*").eq("tenant_id", currentTenantId).order("created_at", { ascending: false }),
      supabase.from("activities").select("id, name").eq("tenant_id", currentTenantId).eq("is_active", true).order("name"),
    ]);
    if (itemsRes.error) toast.error(t("common.loadError"));
    else setRows((itemsRes.data ?? []) as Item[]);
    setActivities((actsRes.data ?? []) as ActivityLite[]);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [currentTenantId]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) =>
      r.name.toLowerCase().includes(s) ||
      (r.description ?? "").toLowerCase().includes(s)
    );
  }, [rows, q]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (it: Item) => {
    setEditing(it);
    setForm({
      name: it.name, description: it.description ?? "",
      item_type: it.item_type, activity_id: it.activity_id,
      default_unit: it.default_unit ?? "", default_unit_price: it.default_unit_price ?? 0,
      default_vat_rate: it.default_vat_rate ?? 0,
      accounting_category: it.accounting_category ?? "",
      is_active: it.is_active,
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
      name: parsed.data.name,
      description: parsed.data.description || null,
      item_type: parsed.data.item_type,
      activity_id: parsed.data.activity_id,
      default_unit: parsed.data.default_unit || null,
      default_unit_price: parsed.data.default_unit_price,
      default_vat_rate: parsed.data.default_vat_rate,
      accounting_category: parsed.data.accounting_category || null,
      is_active: parsed.data.is_active,
    };
    const res = editing
      ? await supabase.from("items").update(payload).eq("id", editing.id)
      : await supabase.from("items").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(t("common.saveError")); return; }
    toast.success(t("common.saved"));
    setOpen(false);
    void load();
  };

  const toggleArchive = async (it: Item) => {
    const { error } = await supabase
      .from("items").update({ is_active: !it.is_active }).eq("id", it.id);
    if (error) toast.error(t("common.saveError"));
    else { toast.success(it.is_active ? t("common.archived") : t("common.restored")); void load(); }
  };

  const activityName = (id: string | null) =>
    activities.find((a) => a.id === id)?.name ?? t("items.noActivity");

  return (
    <PageBody>
      <PageHeader
        title={t("items.title")}
        description={t("items.description")}
        actions={
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" />{t("items.new")}
          </Button>
        }
      />

      {rows.length > 0 && (
        <div className="mb-4 relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={t("items.searchPlaceholder")} className="pl-9"
          />
        </div>
      )}

      {loading ? (
        <div className="surface p-6 text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t("items.emptyTitle")}
          description={t("items.emptyDescription")}
          action={<Button onClick={openNew}>{t("items.new")}</Button>}
        />
      ) : (
        <div className="surface divide-y divide-border">
          {filtered.map((it) => (
            <div key={it.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium truncate">{it.name}</div>
                  <Badge variant="secondary">{t(`items.type.${it.item_type}`)}</Badge>
                  <Badge variant="outline">{activityName(it.activity_id)}</Badge>
                  {!it.is_active && <Badge variant="outline">{t("common.inactive")}</Badge>}
                </div>
                {it.description && (
                  <div className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{it.description}</div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {(it.default_unit_price ?? 0).toFixed(2)} € / {it.default_unit ?? "—"} · TVA {it.default_vat_rate ?? 0}%
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => openEdit(it)} className="gap-1">
                  <Pencil className="h-4 w-4" />{t("common.edit")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleArchive(it)} className="gap-1">
                  {it.is_active
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
            <DialogTitle>{editing ? t("items.edit") : t("items.new")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>{t("items.fields.name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("items.fields.description")}</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>{t("items.fields.item_type")}</Label>
              <Select value={form.item_type} onValueChange={(v) => setForm({ ...form, item_type: v as ItemType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((it) => (
                    <SelectItem key={it} value={it}>{t(`items.type.${it}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("items.fields.activity")}</Label>
              <Select
                value={form.activity_id ?? NO_ACTIVITY}
                onValueChange={(v) => setForm({ ...form, activity_id: v === NO_ACTIVITY ? null : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ACTIVITY}>{t("items.noActivity")}</SelectItem>
                  {activities.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("items.fields.unit")}</Label>
              <Input value={form.default_unit} onChange={(e) => setForm({ ...form, default_unit: e.target.value })} />
            </div>
            <div>
              <Label>{t("items.fields.unit_price")}</Label>
              <Input type="number" step="0.01" min="0"
                value={form.default_unit_price ?? 0}
                onChange={(e) => setForm({ ...form, default_unit_price: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>{t("items.fields.vat_rate")}</Label>
              <Input type="number" step="0.01" min="0" max="100"
                value={form.default_vat_rate ?? 0}
                onChange={(e) => setForm({ ...form, default_vat_rate: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>{t("items.fields.accounting_category")}</Label>
              <Input value={form.accounting_category}
                onChange={(e) => setForm({ ...form, accounting_category: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label className="cursor-pointer">{t("items.fields.is_active")}</Label>
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
