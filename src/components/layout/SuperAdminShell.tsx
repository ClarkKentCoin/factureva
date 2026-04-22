import { ReactNode, useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import {
  ShieldCheck, Building2, Gauge, FileSearch, ScrollText, Menu, LogOut, Globe, ExternalLink,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { setInterfaceLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function SuperAdminShell({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { signOut, user, memberships } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const items = [
    { to: "/superadmin", label: t("superadmin.nav.overview"), icon: Gauge, end: true },
    { to: "/superadmin/tenants", label: t("superadmin.nav.tenants"), icon: Building2 },
    { to: "/superadmin/plans", label: t("superadmin.nav.plans"), icon: ScrollText },
    { to: "/superadmin/audit", label: t("superadmin.nav.audit"), icon: FileSearch },
  ];

  // Sidebar uses a flex column with a pinned footer. The wrapper that mounts
  // it gives it a real height (h-screen sticky on desktop, full-height drawer
  // on mobile), so `mt-auto` reliably anchors the footer at the bottom.
  const Sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-primary text-primary-foreground">
      <div className="px-5 py-5 border-b border-primary-foreground/10 shrink-0">
        <Link to="/superadmin" className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <div className="min-w-0">
            <div className="font-serif text-xl leading-none truncate">{t("nav.superadmin")}</div>
            <div className="text-[11px] opacity-70 mt-1 truncate">{t("superadmin.console")}</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 min-h-0 px-3 py-3 space-y-0.5 overflow-y-auto">
        {items.map((it) => (
          <NavLink
            key={it.to} to={it.to} end={it.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-primary-foreground/80 hover:bg-primary-foreground/10",
              )
            }
          >
            <it.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{it.label}</span>
          </NavLink>
        ))}

        {memberships.length > 0 && (
          <NavLink
            to="/app"
            onClick={() => setOpen(false)}
            className="mt-3 flex items-center gap-2 px-3 py-2 rounded-md text-xs text-primary-foreground/70 hover:bg-primary-foreground/10 border border-dashed border-primary-foreground/20"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{t("superadmin.shell.openTenantApp")}</span>
          </NavLink>
        )}
      </nav>

      {/* Pinned footer */}
      <div className="mt-auto shrink-0 px-3 py-3 border-t border-primary-foreground/10 space-y-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost" size="sm"
              className="w-full justify-start gap-2 text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Globe className="h-4 w-4" />
              <span className="text-xs uppercase">{i18n.language}</span>
              <span className="ml-1 text-[11px] opacity-70 normal-case">
                {t("superadmin.shell.language")}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem onClick={() => setInterfaceLanguage("fr")}>Français</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setInterfaceLanguage("en")}>English</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setInterfaceLanguage("ru")}>Русский</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="px-2 py-1 text-xs opacity-70 truncate">{user?.email}</div>
        <Button
          variant="ghost" size="sm"
          className="w-full justify-start gap-2 text-primary-foreground hover:bg-primary-foreground/10"
          onClick={async () => { await signOut(); navigate("/auth/sign-in"); }}
        >
          <LogOut className="h-4 w-4" /> {t("nav.signOut")}
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop: sticky full-height column so the footer never drifts */}
      <div className="hidden md:flex sticky top-0 h-screen self-start">{Sidebar}</div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] h-full">{Sidebar}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-[hsl(var(--surface))]">
          <button
            onClick={() => setOpen(true)}
            className="p-2 -ml-2 rounded-md hover:bg-muted"
            aria-label="menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="font-serif text-xl truncate">{t("nav.superadmin")}</div>
          <div className="w-9" />
        </header>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
