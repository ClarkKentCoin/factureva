import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!session) return <Navigate to="/auth/sign-in" replace state={{ from: location }} />;
  return children;
}

export function RequireTenant({ children }: { children: JSX.Element }) {
  const { session, loading, profileLoading, memberships } = useAuth();
  const location = useLocation();
  // CRITICAL: wait for the membership lookup to finish before deciding to send
  // the user to onboarding. Otherwise existing members get bounced to "create
  // workspace" on every login (race between session ready vs. profile loaded).
  if (loading || (session && profileLoading)) return <FullPageLoader />;
  if (!session) return <Navigate to="/auth/sign-in" replace state={{ from: location }} />;
  if (memberships.length === 0) return <Navigate to="/onboarding" replace />;
  return children;
}

export function RequireSuperAdmin({ children }: { children: JSX.Element }) {
  const { session, loading, profileLoading, isSuperAdmin } = useAuth();
  if (loading || (session && profileLoading)) return <FullPageLoader />;
  if (!session) return <Navigate to="/auth/sign-in" replace />;
  if (!isSuperAdmin) return <Navigate to="/app" replace />;
  return children;
}

export function GuestOnly({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (session) return <Navigate to="/app" replace />;
  return children;
}

function FullPageLoader() {
  return (
    <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">
      …
    </div>
  );
}
