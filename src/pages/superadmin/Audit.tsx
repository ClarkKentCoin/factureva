import { PageBody, PageHeader, EmptyState } from "@/components/layout/PageScaffold";

export default function SuperAdminAudit() {
  return (
    <PageBody>
      <PageHeader title="Audit logs" description="Tenant and platform actions" />
      <EmptyState title="No events yet" description="Sensitive actions (sign-ins, role changes, super_admin operations) will appear here." />
    </PageBody>
  );
}
