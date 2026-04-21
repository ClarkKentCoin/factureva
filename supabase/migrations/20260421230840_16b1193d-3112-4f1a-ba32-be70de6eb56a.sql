
-- UP
CREATE TABLE public.invoice_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  recipient text NOT NULL,
  cc text,
  subject text NOT NULL,
  body text,
  status text NOT NULL DEFAULT 'queued',
  provider text,
  provider_message_id text,
  error_message text,
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_email_logs_invoice ON public.invoice_email_logs(invoice_id);
CREATE INDEX idx_invoice_email_logs_tenant ON public.invoice_email_logs(tenant_id, created_at DESC);

ALTER TABLE public.invoice_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iel_member_select" ON public.invoice_email_logs
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- Inserts happen only via the edge function (service role); no insert policy for authenticated users.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sent_to text;
