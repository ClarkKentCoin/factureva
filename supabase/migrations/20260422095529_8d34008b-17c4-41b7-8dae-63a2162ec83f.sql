-- UP
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_archived_at
  ON public.tenants (archived_at);

-- DOWN (manual reference, not executed):
-- DROP INDEX IF EXISTS public.idx_tenants_archived_at;
-- ALTER TABLE public.tenants DROP COLUMN IF EXISTS archived_at;