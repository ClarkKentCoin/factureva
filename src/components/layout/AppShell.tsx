import { ReactNode, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FileText, FileSignature, FileMinus, Users, Building2, Package,
  Briefcase, Settings, LogOut, Menu, X, ShieldCheck, Globe, Plus, ChevronsUpDown, Check, Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { setInterfaceLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { signOut, isSuperAdmin, activeMemberships, currentTenantId, setCurrentTenantId, user } = useAuth();
  const memberships = activeMemberships;
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const items = [
    { to: "/app", label: t("nav.dashboard"), icon: LayoutDashboard, end: true },
    { to: "/app/invoices", label: t("nav.invoices"), icon: FileText },
    { to: "/app/devis", label: t("nav.devis"), icon: FileSignature },
    { to: "/app/credit-notes", label: t("nav.creditNotes"), icon: FileMinus },
    { to: "/app/clients", label: t("nav.clients"), icon: Users },
    { to: "/app/items", label: t("nav.items"), icon: Package },
    { to: "/app/activities", label: t("nav.activities"), icon: Briefcase },
    { to: "/app/company", label: t("nav.company"), icon: Building2 },
    { to: "/app/settings/team", label: t("nav.team"), icon: Users },
    { to: "/app/settings/plan", label: t("nav.plan"), icon: Sparkles },
    { to: "/app/settings", label: t("nav.settings"), icon: Settings },
  ];

  const current = memberships.find((m) => m.tenant_id === currentTenantId);

  const Sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-[hsl(var(--surface))]">
      <div className="px-5 py-5 border-b border-border">
        <Link to="/app" className="block">
          <div className="font-serif text-2xl leading-none">Facturly</div>
          <div className="text-xs text-muted-foreground mt-1">{t("app.tagline")}</div>
        </Link>
      </div>

      {memberships.length > 0 && (
        <div className="px-3 py-3 border-b border-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full text-left px-2 py-2 rounded-md hover:bg-muted transition flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-accent text-accent-foreground grid place-items-center text-xs font-semibold">
                  {current?.tenant.name?.[0]?.toUpperCase() ?? "·"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{current?.tenant.name ?? "—"}</div>
                  <div className="text-[11px] text-muted-foreground capitalize">{current?.role}</div>
                </div>
                <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              {memberships.map((m) => (
                <DropdownMenuItem key={m.tenant_id} onClick={() => setCurrentTenantId(m.tenant_id)}>
                  <span className="truncate flex-1">{m.tenant.name}</span>
                  {m.tenant_id === currentTenantId && <Check className="h-4 w-4 ml-2" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setOpen(false); navigate("/app/workspaces"); }}>
                <Settings className="h-4 w-4 mr-2" />
                {t("workspaces.manage")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setOpen(false); navigate("/app/workspaces?new=1"); }}>
                <Plus className="h-4 w-4 mr-2" />
                {t("workspaces.create")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition",
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-foreground/75 hover:bg-muted"
              )
            }
          >
            <it.icon className="h-4 w-4" />
            <span>{it.label}</span>
          </NavLink>
        ))}
        {isSuperAdmin && (
          <NavLink
            to="/superadmin"
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                "mt-3 flex items-center gap-2 px-3 py-2 rounded-md text-sm transition border border-dashed border-border",
                isActive ? "bg-accent text-accent-foreground" : "text-foreground/75 hover:bg-muted"
              )
            }
          >
            <ShieldCheck className="h-4 w-4" />
            <span>{t("nav.superadmin")}</span>
          </NavLink>
        )}
      </nav>

      <div className="px-3 py-3 border-t border-border space-y-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
              <Globe className="h-4 w-4" />
              <span className="text-xs uppercase">{i18n.language}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setInterfaceLanguage("fr")}>Français</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setInterfaceLanguage("en")}>English</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setInterfaceLanguage("ru")}>Русский</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="px-2 py-1 text-xs text-muted-foreground truncate">{user?.email}</div>
        <Button
          variant="ghost" size="sm" className="w-full justify-start gap-2"
          onClick={async () => { await signOut(); navigate("/auth/sign-in"); }}
        >
          <LogOut className="h-4 w-4" />
          {t("nav.signOut")}
        </Button>
      </div>
    </aside>
  );

  // Reset mobile drawer on route change
  if (open && location.pathname) {
    // close handled by NavLink onClick; nothing else needed
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar — sticky full-height so footer (lang/email/logout) stays visible */}
      <div className="hidden md:flex sticky top-0 h-screen self-start">{Sidebar}</div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw]">{Sidebar}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-[hsl(var(--surface))]">
          <button
            aria-label="menu"
            onClick={() => setOpen(true)}
            className="p-2 -ml-2 rounded-md hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="font-serif text-xl">Facturly</div>
          <div className="w-9" />
        </header>

        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

// Keep an unused export to silence tree-shaking lint if needed
export const _icons = { X };
