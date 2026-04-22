-- 1. Enum value (must commit before being used by functions/triggers below)
ALTER TYPE public.invoice_document_type ADD VALUE IF NOT EXISTS 'credit_note';

-- 2. New column: a credit note links to the source invoice it corrects.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS source_invoice_id uuid
    REFERENCES public.invoices(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_invoices_source_invoice_id
  ON public.invoices(source_invoice_id);

-- 3. Optional correction reason (used by credit notes UI).
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS correction_reason text;