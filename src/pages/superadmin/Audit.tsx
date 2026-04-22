import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageBody, PageHeader, EmptyState } from "@/components/layout/PageScaffold";
import { listSuperadminAudit } from "@/lib/superadmin";

type Row = Awaited<ReturnType<typeof listSuperadminAudit>>[number];

export default function SuperAdminAudit() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    listSuperadminAudit(200).then(setRows).catch(() => setRows([]));
  }, []);

  return (
    <PageBody>
      <PageHeader title={t("superadmin.audit.title")} description={t("superadmin.audit.description")} />

      {!rows ? (
        <div className="text-sm text-muted-foreground">{t("superadmin.common.loading")}</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={t("superadmin.audit.emptyTitle")}
          description={t("superadmin.audit.emptyDescription")}
        />
      ) : (
        <div className="surface divide-y divide-border">
          {rows.map((r) => (
            <div key={r.id} className="p-4 grid gap-2 md:grid-cols-[160px,200px,1fr] items-start">
              <div className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </div>
              <div className="text-sm font-medium">{r.action}</div>
              <div className="text-xs text-muted-foreground space-y-1">
                {r.tenant_id && (
                  <div>
                    <Link to={`/superadmin/tenants/${r.tenant_id}`} className="hover:underline">
                      {t("superadmin.audit.target")}: {r.tenant_id.slice(0, 8)}…
                    </Link>
                  </div>
                )}
                {r.metadata && Object.keys(r.metadata as object).length > 0 && (
                  <pre className="bg-muted/50 rounded p-2 text-[11px] whitespace-pre-wrap break-all">
                    {JSON.stringify(r.metadata, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageBody>
  );
}
