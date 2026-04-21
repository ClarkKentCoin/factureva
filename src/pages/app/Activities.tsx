import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Archive, ArchiveRestore } from "lucide-react";
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
import {
  NATURES_OF_ACTIVITY, NAF_SECTIONS, NAF_DIVISIONS_BY_SECTION,
  getSectionLabel, getDivisionLabel, type NatureOfActivity,
} from "@/lib/naf";

type Activity = {
  id: string;
  tenant_id: string;
  name: string;
  nature_of_activity: NatureOfActivity;
  naf_section_code: string;
  naf_section_label: string;
  naf_division_code: string | null;
  naf_division_label: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

const NONE = "__none__";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  nature_of_activity: z.enum(NATURES_OF_ACTIVITY),
  naf_section_code: z.string().min(1).max(2),
  naf_division_code: z.string().max(2).optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  is_active: z.boolean(),
});
type FormData = z.infer<typeof schema>;

const emptyForm: FormData = {
  name: "",
  nature_of_activity: "commerciale",
  naf_section_code: "S",
  naf_division_code: "",
  description: "",
  is_active: true,
};

export default function ActivitiesPage() {
  const { t } = useTranslation();
  const { currentTenantId } = useAuth();
  const [rows, setRows] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!currentTenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .eq("tenant_id", currentTenantId)
      .order("created_at", { ascending: false });
    if (error) toast.error(t("common.loadError"));
    else setRows((data ?? []) as unknown as Activity[]);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [currentTenantId]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (a: Activity) => {
    setEditing(a);
    setForm({
      name: a.name,
      nature_of_activity: a.nature_of_activity,
      naf_section_code: a.naf_section_code,
      naf_division_code: a.naf_division_code ?? "",
      description: a.description ?? "",
      is_active: a.is_active,
    });
    setOpen(true);
  };

  const divisionsForSection = useMemo(
    () => NAF_DIVISIONS_BY_SECTION[form.naf_section_code] ?? [],
    [form.naf_section_code],
  );

  const submit = async () => {
    if (!currentTenantId) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(t("company.toasts.invalid")); return; }
    setSaving(true);
    const sectionLabel = getSectionLabel(parsed.data.naf_section_code);
    const divisionCode = parsed.data.naf_division_code || null;
    const divisionLabel = divisionCode
      ? getDivisionLabel(parsed.data.naf_section_code, divisionCode) || null
      : null;

    const payload = {
      tenant_id: currentTenantId,
      name: parsed.data.name,
      nature_of_activity: parsed.data.nature_of_activity,
      naf_section_code: parsed.data.naf_section_code,
      naf_section_label: sectionLabel,
      naf_division_code: divisionCode,
      naf_division_label: divisionLabel,
      description: parsed.data.description || null,
      is_active: parsed.data.is_active,
    };
    // Cast to any: the generated types file hasn't picked up the new columns yet.
    const res = editing
      ? await supabase.from("activities").update(payload as any).eq("id", editing.id)
      : await supabase.from("activities").insert(payload as any);
    setSaving(false);
    if (res.error) { toast.error(t("common.saveError")); return; }
    toast.success(t("common.saved"));
    setOpen(false);
    void load();
  };

  const toggleArchive = async (a: Activity) => {
    const { error } = await supabase
      .from("activities")
      .update({ is_active: !a.is_active })
      .eq("id", a.id);
    if (error) toast.error(t("common.saveError"));
    else { toast.success(a.is_active ? t("common.archived") : t("common.restored")); void load(); }
  };

  return (
    <PageBody>
      <PageHeader
        title={t("activities.title")}
        description={t("activities.description")}
        actions={
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" />{t("activities.new")}
          </Button>
        }
      />

      {loading ? (
        <div className="surface p-6 text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={t("activities.emptyTitle")}
          description={t("activities.emptyDescription")}
          action={<Button onClick={openNew}>{t("activities.new")}</Button>}
        />
      ) : (
        <div className="surface divide-y divide-border">
          {rows.map((a) => (
            <div key={a.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium truncate">{a.name}</div>
                  <Badge variant="secondary">
                    {t(`activities.nature.${a.nature_of_activity}`)}
                  </Badge>
                  <Badge variant="outline">
                    NAF {a.naf_section_code}
                    {a.naf_division_code ? `.${a.naf_division_code}` : ""}
                  </Badge>
                  {!a.is_active && <Badge variant="outline">{t("common.inactive")}</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  {a.naf_section_label}
                  {a.naf_division_label ? ` · ${a.naf_division_label}` : ""}
                </div>
                {a.description && (
                  <div className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{a.description}</div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => openEdit(a)} className="gap-1">
                  <Pencil className="h-4 w-4" />{t("common.edit")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleArchive(a)} className="gap-1">
                  {a.is_active
                    ? (<><Archive className="h-4 w-4" />{t("common.archive")}</>)
                    : (<><ArchiveRestore className="h-4 w-4" />{t("common.restore")}</>)}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t("activities.edit") : t("activities.new")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("activities.fields.name")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("activities.fields.namePlaceholder")}
              />
            </div>

            <div>
              <Label>{t("activities.fields.nature")}</Label>
              <Select
                value={form.nature_of_activity}
                onValueChange={(v) => setForm({ ...form, nature_of_activity: v as NatureOfActivity })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NATURES_OF_ACTIVITY.map((n) => (
                    <SelectItem key={n} value={n}>
                      {t(`activities.nature.${n}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {t(`activities.natureHelp.${form.nature_of_activity}`)}
              </p>
            </div>

            <div>
              <Label>{t("activities.fields.naf_section")}</Label>
              <Select
                value={form.naf_section_code}
                onValueChange={(v) => setForm({ ...form, naf_section_code: v, naf_division_code: "" })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {NAF_SECTIONS.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.code} — {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {divisionsForSection.length > 0 && (
              <div>
                <Label>
                  {t("activities.fields.naf_division")}{" "}
                  <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
                </Label>
                <Select
                  value={form.naf_division_code || NONE}
                  onValueChange={(v) => setForm({ ...form, naf_division_code: v === NONE ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder={t("activities.fields.naf_division_placeholder")} /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value={NONE}>{t("common.none")}</SelectItem>
                    {divisionsForSection.map((d) => (
                      <SelectItem key={d.code} value={d.code}>
                        {d.code} — {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>{t("activities.fields.description")}</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label className="cursor-pointer">{t("activities.fields.is_active")}</Label>
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
