import { useTranslation } from "react-i18next";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

export type DocFilters = {
  q: string;
  status: string;          // "" = any
  clientId: string;        // "" = any
  dateFrom: string;        // ISO date
  dateTo: string;
  amountMin: string;
  amountMax: string;
  /** invoice-only */
  unpaidOnly?: boolean;
  dueSoon?: boolean;
  /** devis-only */
  validUntilSoon?: boolean;
  sentOnly?: boolean;
};

export const EMPTY_FILTERS: DocFilters = {
  q: "", status: "", clientId: "",
  dateFrom: "", dateTo: "", amountMin: "", amountMax: "",
  unpaidOnly: false, dueSoon: false, validUntilSoon: false, sentOnly: false,
};

type Props = {
  filters: DocFilters;
  onChange: (next: DocFilters) => void;
  statusOptions: { value: string; label: string }[];
  clientOptions: { value: string; label: string }[];
  /** which "smart" toggles to show */
  variant: "invoice" | "devis";
};

export function DocumentsToolbar({ filters, onChange, statusOptions, clientOptions, variant }: Props) {
  const { t } = useTranslation();
  const set = <K extends keyof DocFilters>(k: K, v: DocFilters[K]) =>
    onChange({ ...filters, [k]: v });

  const activeCount =
    (filters.status ? 1 : 0) +
    (filters.clientId ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0) +
    (filters.amountMin ? 1 : 0) +
    (filters.amountMax ? 1 : 0) +
    (filters.unpaidOnly ? 1 : 0) +
    (filters.dueSoon ? 1 : 0) +
    (filters.validUntilSoon ? 1 : 0) +
    (filters.sentOnly ? 1 : 0);

  return (
    <div className="flex flex-col sm:flex-row gap-2 mb-3">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={filters.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder={t("lists.searchPlaceholder")}
          className="pl-8"
        />
        {filters.q && (
          <button
            type="button"
            aria-label="clear search"
            onClick={() => set("q", "")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Select value={filters.status || "__any"} onValueChange={(v) => set("status", v === "__any" ? "" : v)}>
        <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__any">{t("lists.anyStatus")}</SelectItem>
          {statusOptions.map((s) => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            {t("lists.filters")}
            {activeCount > 0 && (
              <span className="ml-1 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5">
                {activeCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[320px] sm:w-[360px] space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{t("lists.from")}</Label>
              <Input type="date" value={filters.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("lists.to")}</Label>
              <Input type="date" value={filters.dateTo} onChange={(e) => set("dateTo", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{t("lists.amountMin")}</Label>
              <Input type="number" inputMode="decimal" value={filters.amountMin}
                onChange={(e) => set("amountMin", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("lists.amountMax")}</Label>
              <Input type="number" inputMode="decimal" value={filters.amountMax}
                onChange={(e) => set("amountMax", e.target.value)} />
            </div>
          </div>

          {clientOptions.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">{t("lists.anyClient")}</Label>
              <Select value={filters.clientId || "__any"} onValueChange={(v) => set("clientId", v === "__any" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any">{t("lists.anyClient")}</SelectItem>
                  {clientOptions.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2 pt-1 border-t border-border">
            {variant === "invoice" && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={!!filters.unpaidOnly}
                    onCheckedChange={(v) => set("unpaidOnly", !!v)} />
                  {t("lists.unpaidOnly")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={!!filters.dueSoon}
                    onCheckedChange={(v) => set("dueSoon", !!v)} />
                  {t("lists.dueSoon")}
                </label>
              </>
            )}
            {variant === "devis" && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={!!filters.sentOnly}
                    onCheckedChange={(v) => set("sentOnly", !!v)} />
                  {t("lists.sentOnly")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={!!filters.validUntilSoon}
                    onCheckedChange={(v) => set("validUntilSoon", !!v)} />
                  {t("lists.validUntilSoon")}
                </label>
              </>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...EMPTY_FILTERS, q: filters.q })}>
              {t("lists.clear")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function Pager({
  page, pageSize, total, onPageChange,
}: { page: number; pageSize: number; total: number; onPageChange: (p: number) => void }) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border text-sm">
      <div className="text-muted-foreground">{t("lists.showing", { from, to, total })}</div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}>{t("lists.prev")}</Button>
        <div className="text-muted-foreground">{t("lists.page", { page, total: totalPages })}</div>
        <Button variant="outline" size="sm" disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}>{t("lists.next")}</Button>
      </div>
    </div>
  );
}
