import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Membership = {
  tenant_id: string;
  role: "owner" | "admin" | "member" | "viewer";
  tenant: { id: string; name: string; slug: string | null };
};

type AuthCtx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isSuperAdmin: boolean;
  memberships: Membership[];
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
    // Memberships
    const { data: members } = await supabase
      .from("tenant_members")
      .select("tenant_id, role, tenants:tenant_id(id, name, slug)")
      .eq("user_id", uid);
    const m: Membership[] = (members ?? []).map((r: any) => ({
      tenant_id: r.tenant_id,
      role: r.role,
      tenant: r.tenants,
    }));
    setMemberships(m);

    // Default current tenant if none chosen
    if (!localStorage.getItem(TENANT_KEY) && m[0]) {
      setCurrentTenantId(m[0].tenant_id);
    }

    // Super admin?
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "super_admin");
    setIsSuperAdmin((roles ?? []).length > 0);
  };

  const refresh = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  useEffect(() => {
    // Listener FIRST, then getSession (per Supabase guidance)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        // Defer to avoid deadlocks
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setMemberships([]);
        setIsSuperAdmin(false);
        setCurrentTenantId(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) loadProfile(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setCurrentTenantId(null);
  };

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        isSuperAdmin,
        memberships,
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
