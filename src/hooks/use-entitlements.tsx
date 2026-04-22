import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getEntitlementSnapshot,
  type EntitlementSnapshot,
  hasFeature as _hasFeature,
  getLimit as _getLimit,
  type FeatureKey,
  type LimitKey,
} from "@/lib/entitlements";

type Ctx = {
  snapshot: EntitlementSnapshot | null;
  loading: boolean;
  refresh: () => Promise<void>;
  hasFeature: (key: FeatureKey) => boolean;
  getLimit: (key: LimitKey) => number | null;
};

const EntitlementsCtx = createContext<Ctx | undefined>(undefined);

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const { currentTenantId } = useAuth();
  const [snapshot, setSnapshot] = useState<EntitlementSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentTenantId) { setSnapshot(null); setLoading(false); return; }
    setLoading(true);
    try { setSnapshot(await getEntitlementSnapshot(currentTenantId)); }
    finally { setLoading(false); }
  }, [currentTenantId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <EntitlementsCtx.Provider
      value={{
        snapshot,
        loading,
        refresh: load,
        hasFeature: (k) => _hasFeature(snapshot, k),
        getLimit: (k) => _getLimit(snapshot, k),
      }}
    >
      {children}
    </EntitlementsCtx.Provider>
  );
}

export function useEntitlements(): Ctx {
  const ctx = useContext(EntitlementsCtx);
  if (!ctx) throw new Error("useEntitlements must be used within EntitlementsProvider");
  return ctx;
}
