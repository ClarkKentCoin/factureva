-- Validation trigger: credit notes must point to an invoice (not devis/credit_note)
CREATE OR REPLACE FUNCTION public.validate_credit_note_source()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src_type invoice_document_type;
BEGIN
  IF NEW.document_type <> 'credit_note' THEN
    RETURN NEW;
  END IF;

  IF NEW.source_invoice_id IS NULL THEN
    RAISE EXCEPTION 'credit_note_requires_source_invoice';
  END IF;

  SELECT document_type INTO v_src_type
    FROM public.invoices WHERE id = NEW.source_invoice_id;
  IF v_src_type IS NULL THEN
    RAISE EXCEPTION 'credit_note_source_not_found';
  END IF;
  IF v_src_type <> 'invoice' THEN
    RAISE EXCEPTION 'credit_note_source_must_be_invoice';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_credit_note_source ON public.invoices;
CREATE TRIGGER trg_validate_credit_note_source
BEFORE INSERT OR UPDATE OF source_invoice_id, document_type
ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.validate_credit_note_source();

-- Cap validation trigger: cumulative issued credit notes must not exceed source invoice total.
CREATE OR REPLACE FUNCTION public.validate_credit_note_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src_total numeric;
  v_already   numeric;
  v_current   numeric;
BEGIN
  IF NEW.document_type <> 'credit_note' THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'issued' THEN
    RETURN NEW;
  END IF;
  IF NEW.source_invoice_id IS NULL THEN
    RAISE EXCEPTION 'credit_note_requires_source_invoice';
  END IF;

  SELECT total_ttc INTO v_src_total
    FROM public.invoices WHERE id = NEW.source_invoice_id FOR UPDATE;

  SELECT COALESCE(SUM(total_ttc), 0) INTO v_already
    FROM public.invoices
   WHERE document_type = 'credit_note'
     AND source_invoice_id = NEW.source_invoice_id
     AND status = 'issued'
     AND id <> NEW.id;

  v_current := COALESCE(NEW.total_ttc, 0);

  IF (v_already + v_current) > COALESCE(v_src_total, 0) + 0.005 THEN
    RAISE EXCEPTION 'credit_note_exceeds_source_total';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_credit_note_cap ON public.invoices;
CREATE TRIGGER trg_validate_credit_note_cap
BEFORE INSERT OR UPDATE OF status, total_ttc, source_invoice_id
ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.validate_credit_note_cap();

-- Update claim_invoice_number to support credit_note → AV- prefix
CREATE OR REPLACE FUNCTION public.claim_invoice_number(_tenant_id uuid, _document_type invoice_document_type, _year integer)
RETURNS text
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

  prefix := CASE _document_type
    WHEN 'invoice'     THEN 'INV'
    WHEN 'devis'       THEN 'DEV'
    WHEN 'credit_note' THEN 'AV'
    ELSE 'DOC'
  END;
  RETURN prefix || '-' || _year::text || '-' || lpad(next_val::text, 6, '0');
END;
$$;