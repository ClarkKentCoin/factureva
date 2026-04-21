import { PageBody, PageHeader, StatCard, EmptyState } from "@/components/layout/PageScaffold";

export default function SuperAdminOverview() {
  return (
    <PageBody>
      <PageHeader title="Platform overview" description="Health and high-level metrics" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Tenants" value="—" />
        <StatCard label="Users" value="—" />
        <StatCard label="Active subscriptions" value="—" />
      </div>
      <EmptyState
        title="Diagnostics coming soon"
        description="Tenant list, plan/usage visibility, support tools and platform audit logs are scaffolded."
      />
    </PageBody>
  );
}
