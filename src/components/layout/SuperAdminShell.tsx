import { ReactNode, useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { ShieldCheck, Building2, Gauge, FileSearch, ScrollText, Menu, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SuperAdminShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const items = [
    { to: "/superadmin", label: "Overview", icon: Gauge, end: true },
    { to: "/superadmin/tenants", label: "Tenants", icon: Building2 },
    { to: "/superadmin/plans", label: "Plans & features", icon: ScrollText },
    { to: "/superadmin/audit", label: "Audit logs", icon: FileSearch },
  ];

  const Sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-primary text-primary-foreground">
      <div className="px-5 py-5 border-b border-primary-foreground/10">
        <Link to="/superadmin" className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <div>
            <div className="font-serif text-xl leading-none">Superadmin</div>
            <div className="text-[11px] opacity-70 mt-1">Platform console</div>
          </div>
        </Link>
      </div>
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {items.map((it) => (
          <NavLink
            key={it.to} to={it.to} end={it.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition",
                isActive ? "bg-accent text-accent-foreground" : "text-primary-foreground/80 hover:bg-primary-foreground/10"
              )
            }
          >
            <it.icon className="h-4 w-4" />
            <span>{it.label}</span>
          </NavLink>
        ))}
        <NavLink
          to="/app"
          className="mt-3 block px-3 py-2 rounded-md text-xs text-primary-foreground/60 hover:bg-primary-foreground/10"
        >
          ← Back to tenant app
        </NavLink>
      </nav>
      <div className="px-3 py-3 border-t border-primary-foreground/10 space-y-1">
        <div className="px-2 py-1 text-xs opacity-70 truncate">{user?.email}</div>
        <Button
          variant="ghost" size="sm" className="w-full justify-start gap-2 text-primary-foreground hover:bg-primary-foreground/10"
          onClick={async () => { await signOut(); navigate("/auth/sign-in"); }}
        >
          <LogOut className="h-4 w-4" /> {t("nav.signOut")}
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden md:flex">{Sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw]">{Sidebar}</div>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-[hsl(var(--surface))]">
          <button onClick={() => setOpen(true)} className="p-2 -ml-2 rounded-md hover:bg-muted" aria-label="menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="font-serif text-xl">Superadmin</div>
          <div className="w-9" />
        </header>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
