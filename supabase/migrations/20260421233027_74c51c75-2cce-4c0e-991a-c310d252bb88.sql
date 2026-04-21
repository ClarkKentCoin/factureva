-- 1) Extend enums (Postgres requires separate ALTER TYPE statements, no IF NOT EXISTS in older versions; use DO blocks).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'devis'
      AND enumtypid = 'public.invoice_document_type'::regtype) THEN
    ALTER TYPE public.invoice_document_type ADD VALUE 'devis';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sent'
      AND enumtypid = 'public.invoice_status'::regtype) THEN
    ALTER TYPE public.invoice_status ADD VALUE 'sent';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'accepted'
      AND enumtypid = 'public.invoice_status'::regtype) THEN
    ALTER TYPE public.invoice_status ADD VALUE 'accepted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'rejected'
      AND enumtypid = 'public.invoice_status'::regtype) THEN
    ALTER TYPE public.invoice_status ADD VALUE 'rejected';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'expired'
      AND enumtypid = 'public.invoice_status'::regtype) THEN
    ALTER TYPE public.invoice_status ADD VALUE 'expired';
  END IF;
END$$;

-- 2) Devis -> Facture link on invoices (preserves the original devis).
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS source_devis_id uuid NULL REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS invoices_source_devis_id_idx ON public.invoices(source_devis_id);
CREATE INDEX IF NOT EXISTS invoices_tenant_doctype_idx ON public.invoices(tenant_id, document_type);

-- 3) Update numbering function to support devis prefix (DEV).
CREATE OR REPLACE FUNCTION public.claim_invoice_number(_tenant_id uuid, _document_type invoice_document_type, _year integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  prefix := CASE _document_type
    WHEN 'invoice' THEN 'INV'
    WHEN 'devis'   THEN 'DEV'
    ELSE 'DOC'
  END;
  RETURN prefix || '-' || _year::text || '-' || lpad(next_val::text, 6, '0');
END;
$function$;

-- 4) Harden payment recompute: only ever touch invoices, never devis.
CREATE OR REPLACE FUNCTION public.recompute_invoice_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice_id uuid;
  v_total numeric;
  v_paid numeric;
  v_status invoice_status;
  v_doctype invoice_document_type;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT total_ttc, status, document_type INTO v_total, v_status, v_doctype
  FROM public.invoices WHERE id = v_invoice_id;

  -- Devis must never be marked paid via payments (no such concept).
  IF v_doctype IS DISTINCT FROM 'invoice' THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(amount),0) INTO v_paid
  FROM public.invoice_payments WHERE invoice_id = v_invoice_id;

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
$function$;