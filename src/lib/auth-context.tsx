import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Membership = {
  tenant_id: string;
  role: "owner" | "admin" | "member" | "viewer";
  tenant: { id: string; name: string; slug: string | null; archived_at: string | null };
};

type AuthCtx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** True until memberships have been loaded for the current session. */
  profileLoading: boolean;
  isSuperAdmin: boolean;
  memberships: Membership[];
  /** Memberships excluding archived workspaces (default switcher view). */
  activeMemberships: Membership[];
  currentTenantId: string | null;
  setCurrentTenantId: (id: string | null) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

const TENANT_KEY = "facturly.tenantId";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentTenantId, setCurrentTenantIdState] = useState<string | null>(
    localStorage.getItem(TENANT_KEY)
  );

  const setCurrentTenantId = (id: string | null) => {
    setCurrentTenantIdState(id);
    if (id) localStorage.setItem(TENANT_KEY, id);
    else localStorage.removeItem(TENANT_KEY);
  };

  const loadProfile = async (uid: string) => {
    setProfileLoading(true);
    try {
      // Memberships (include archived flag so we can filter the switcher)
      const { data: members } = await supabase
        .from("tenant_members")
        .select("tenant_id, role, tenants:tenant_id(id, name, slug, archived_at)")
        .eq("user_id", uid);
      const m: Membership[] = (members ?? []).map((r: any) => ({
        tenant_id: r.tenant_id,
        role: r.role,
        tenant: r.tenants,
      }));
      setMemberships(m);

      // Pick a valid current tenant.
      // Priority: stored id (if still a valid, non-archived membership)
      //   → first non-archived membership
      //   → first membership (even if archived) so user is never forced to onboarding when memberships exist
      const stored = localStorage.getItem(TENANT_KEY);
      const active = m.filter((x) => !x.tenant?.archived_at);
      const isStoredValid = stored && active.some((x) => x.tenant_id === stored);
      if (isStoredValid) {
        if (currentTenantId !== stored) setCurrentTenantIdState(stored);
      } else if (active[0]) {
        setCurrentTenantId(active[0].tenant_id);
      } else if (m[0]) {
        setCurrentTenantId(m[0].tenant_id);
      } else {
        setCurrentTenantId(null);
      }

      // Super admin?
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "super_admin");
      setIsSuperAdmin((roles ?? []).length > 0);
    } finally {
      setProfileLoading(false);
    }
  };

  const refresh = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  useEffect(() => {
    // Listener FIRST, then getSession (per Supabase guidance)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        setProfileLoading(true);
        // Defer to avoid deadlocks
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setMemberships([]);
        setIsSuperAdmin(false);
        setCurrentTenantIdState(null);
        localStorage.removeItem(TENANT_KEY);
        setProfileLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) loadProfile(s.user.id).finally(() => setLoading(false));
      else {
        setProfileLoading(false);
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setCurrentTenantId(null);
  };

  const activeMemberships = memberships.filter((m) => !m.tenant?.archived_at);

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        profileLoading,
        isSuperAdmin,
        memberships,
        activeMemberships,
        currentTenantId,
        setCurrentTenantId,
        refresh,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
