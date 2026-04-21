-- Payment method enum
DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('bank_transfer','card','cash','check','paypal','stripe','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add paid_amount cache to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;

-- Payments table
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL CHECK (amount > 0),
  method public.payment_method NOT NULL DEFAULT 'bank_transfer',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_payments_invoice_idx ON public.invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS invoice_payments_tenant_idx ON public.invoice_payments(tenant_id);

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY ip_member_select ON public.invoice_payments
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY ip_member_insert ON public.invoice_payments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY ip_member_update ON public.invoice_payments
  FOR UPDATE TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY ip_member_delete ON public.invoice_payments
  FOR DELETE TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

-- Recompute trigger: keep invoices.paid_amount + status in sync
CREATE OR REPLACE FUNCTION public.recompute_invoice_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_total numeric;
  v_paid numeric;
  v_status invoice_status;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT COALESCE(SUM(amount),0) INTO v_paid
  FROM public.invoice_payments WHERE invoice_id = v_invoice_id;

  SELECT total_ttc, status INTO v_total, v_status
  FROM public.invoices WHERE id = v_invoice_id;

  IF v_status NOT IN ('cancelled') THEN
    IF v_paid >= v_total AND v_total > 0 THEN
      UPDATE public.invoices
        SET paid_amount = v_paid, status = 'paid', updated_at = now()
        WHERE id = v_invoice_id;
    ELSIF v_status = 'paid' AND v_paid < v_total THEN
      UPDATE public.invoices
        SET paid_amount = v_paid, status = 'issued', updated_at = now()
        WHERE id = v_invoice_id;
    ELSE
      UPDATE public.invoices
        SET paid_amount = v_paid, updated_at = now()
        WHERE id = v_invoice_id;
    END IF;
  ELSE
    UPDATE public.invoices SET paid_amount = v_paid WHERE id = v_invoice_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_invoice_paid_ins ON public.invoice_payments;
CREATE TRIGGER trg_recompute_invoice_paid_ins
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.recompute_invoice_paid();