import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider } from "@/lib/auth-context";
import { EntitlementsProvider } from "@/hooks/use-entitlements";
import { RequireAuth, RequireSuperAdmin, RequireTenant, GuestOnly, PostLoginRedirect } from "@/lib/route-guards";
import { AppShell } from "@/components/layout/AppShell";
import { SuperAdminShell } from "@/components/layout/SuperAdminShell";

import Landing from "./pages/Landing";
import SignIn from "./pages/auth/SignIn";
import SignUp from "./pages/auth/SignUp";
import Onboarding from "./pages/onboarding/Onboarding";
import Dashboard from "./pages/app/Dashboard";
import { SettingsPage } from "./pages/app/Placeholders";
import WorkspacesPage from "./pages/app/Workspaces";
import InvoicesPage from "./pages/app/Invoices";
import InvoiceEditorPage from "./pages/app/InvoiceEditor";
import DevisPage from "./pages/app/Devis";
import DevisEditorPage from "./pages/app/DevisEditor";
import CompanyPage from "./pages/app/Company";
import ClientsPage from "./pages/app/Clients";
import ItemsPage from "./pages/app/Items";
import ActivitiesPage from "./pages/app/Activities";
import PlanPage from "./pages/app/Plan";
import SuperAdminOverview from "./pages/superadmin/Overview";
import SuperAdminTenants from "./pages/superadmin/Tenants";
import SuperAdminTenantDetail from "./pages/superadmin/TenantDetail";
import SuperAdminPlans from "./pages/superadmin/Plans";
import SuperAdminAudit from "./pages/superadmin/Audit";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <EntitlementsProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/auth/sign-in" element={<GuestOnly><SignIn /></GuestOnly>} />
            <Route path="/auth/sign-up" element={<GuestOnly><SignUp /></GuestOnly>} />

            {/* Onboarding (authed but tenant not required) */}
            <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />

            {/* Tenant app */}
            <Route
              path="/app"
              element={<RequireTenant><AppShell><Dashboard /></AppShell></RequireTenant>}
            />
            <Route path="/app/invoices" element={<RequireTenant><AppShell><InvoicesPage /></AppShell></RequireTenant>} />
            <Route path="/app/invoices/new" element={<RequireTenant><AppShell><InvoiceEditorPage /></AppShell></RequireTenant>} />
            <Route path="/app/invoices/:id" element={<RequireTenant><AppShell><InvoiceEditorPage /></AppShell></RequireTenant>} />
            <Route path="/app/devis" element={<RequireTenant><AppShell><DevisPage /></AppShell></RequireTenant>} />
            <Route path="/app/devis/new" element={<RequireTenant><AppShell><DevisEditorPage /></AppShell></RequireTenant>} />
            <Route path="/app/devis/:id" element={<RequireTenant><AppShell><DevisEditorPage /></AppShell></RequireTenant>} />
            <Route path="/app/clients" element={<RequireTenant><AppShell><ClientsPage /></AppShell></RequireTenant>} />
            <Route path="/app/items" element={<RequireTenant><AppShell><ItemsPage /></AppShell></RequireTenant>} />
            <Route path="/app/activities" element={<RequireTenant><AppShell><ActivitiesPage /></AppShell></RequireTenant>} />
            <Route path="/app/company" element={<RequireTenant><AppShell><CompanyPage /></AppShell></RequireTenant>} />
            <Route path="/app/workspaces" element={<RequireTenant><AppShell><WorkspacesPage /></AppShell></RequireTenant>} />
            <Route path="/app/settings" element={<RequireTenant><AppShell><SettingsPage /></AppShell></RequireTenant>} />
            <Route path="/app/settings/plan" element={<RequireTenant><AppShell><PlanPage /></AppShell></RequireTenant>} />
            <Route path="/app/billing" element={<Navigate to="/app/settings/plan" replace />} />

            {/* Superadmin */}
            <Route path="/superadmin" element={<RequireSuperAdmin><SuperAdminShell><SuperAdminOverview /></SuperAdminShell></RequireSuperAdmin>} />
            <Route path="/superadmin/tenants" element={<RequireSuperAdmin><SuperAdminShell><SuperAdminTenants /></SuperAdminShell></RequireSuperAdmin>} />
            <Route path="/superadmin/tenants/:tenantId" element={<RequireSuperAdmin><SuperAdminShell><SuperAdminTenantDetail /></SuperAdminShell></RequireSuperAdmin>} />
            <Route path="/superadmin/plans" element={<RequireSuperAdmin><SuperAdminShell><SuperAdminPlans /></SuperAdminShell></RequireSuperAdmin>} />
            <Route path="/superadmin/audit" element={<RequireSuperAdmin><SuperAdminShell><SuperAdminAudit /></SuperAdminShell></RequireSuperAdmin>} />

            {/* Legacy */}
            <Route path="/index" element={<Navigate to="/" replace />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </EntitlementsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
