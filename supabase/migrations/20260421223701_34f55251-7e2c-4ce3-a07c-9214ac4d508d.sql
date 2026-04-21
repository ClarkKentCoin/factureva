-- =========================================================
-- Invoice Engine Core V1
-- =========================================================

-- Enums
CREATE TYPE public.invoice_document_type AS ENUM ('invoice');
CREATE TYPE public.invoice_status AS ENUM ('draft','issued','paid','overdue','cancelled');

-- Per-tenant, per-year invoice number sequences
CREATE TABLE public.invoice_number_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_type public.invoice_document_type NOT NULL DEFAULT 'invoice',
  year integer NOT NULL,
  last_value integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, document_type, year)
);
ALTER TABLE public.invoice_number_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY ins_member_read ON public.invoice_number_sequences
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(),'super_admin'));

-- Invoices
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  document_type public.invoice_document_type NOT NULL DEFAULT 'invoice',
  status public.invoice_status NOT NULL DEFAULT 'draft',
  invoice_number text,
  issue_date date,
  due_date date,
  currency_code text NOT NULL DEFAULT 'EUR',
  document_language public.document_language NOT NULL DEFAULT 'fr',
  notes text,
  subtotal_ht numeric(14,2) NOT NULL DEFAULT 0,
  total_vat numeric(14,2) NOT NULL DEFAULT 0,
  total_ttc numeric(14,2) NOT NULL DEFAULT 0,
  operation_type text,
  seller_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  legal_requirements_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  issued_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoices_tenant_idx ON public.invoices(tenant_id, created_at DESC);
CREATE INDEX invoices_client_idx ON public.invoices(client_id);
CREATE UNIQUE INDEX invoices_number_unique
  ON public.invoices(tenant_id, document_type, invoice_number)
  WHERE invoice_number IS NOT NULL;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_member_select ON public.invoices
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY invoices_member_insert ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY invoices_member_update ON public.invoices
  FOR UPDATE TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY invoices_admin_delete ON public.invoices
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(tenant_id, auth.uid()));

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Invoice lines
CREATE TABLE public.invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL,
  item_type public.item_type,
  label text NOT NULL,
  description text,
  quantity numeric(14,4) NOT NULL DEFAULT 1,
  unit text,
  unit_price numeric(14,4) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) NOT NULL DEFAULT 0,
  line_subtotal_ht numeric(14,2) NOT NULL DEFAULT 0,
  line_vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  line_total_ttc numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoice_lines_invoice_idx ON public.invoice_lines(invoice_id, sort_order);

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_lines_member_select ON public.invoice_lines
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY invoice_lines_member_write ON public.invoice_lines
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));

-- Numbering function: claim the next invoice number atomically.
-- Format: INV-YYYY-NNNNNN (zero-padded). Tenant + document_type + year scoped.
CREATE OR REPLACE FUNCTION public.claim_invoice_number(
  _tenant_id uuid,
  _document_type public.invoice_document_type,
  _year integer
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_val integer;
  prefix text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_tenant_member(_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  INSERT INTO public.invoice_number_sequences(tenant_id, document_type, year, last_value)
  VALUES (_tenant_id, _document_type, _year, 1)
  ON CONFLICT (tenant_id, document_type, year)
  DO UPDATE SET last_value = public.invoice_number_sequences.last_value + 1,
                updated_at = now()
  RETURNING last_value INTO next_val;

  prefix := CASE _document_type WHEN 'invoice' THEN 'INV' ELSE 'DOC' END;
  RETURN prefix || '-' || _year::text || '-' || lpad(next_val::text, 6, '0');
END;
$$;