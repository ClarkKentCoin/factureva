-- Superadmin V1: minimal additive schema
-- 1) Add tenants.suspended_at (nullable). Distinct from archived_at (user-side archive).
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

-- 2) Allow super_admin to insert into audit_logs directly (read policy already exists).
DROP POLICY IF EXISTS "audit_super_insert" ON public.audit_logs;
CREATE POLICY "audit_super_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 3) Convenience SECURITY DEFINER helper for super_admin actions logging.
CREATE OR REPLACE FUNCTION public.log_superadmin_action(
  _action text,
  _tenant_id uuid,
  _entity_type text,
  _entity_id uuid,
  _metadata jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  INSERT INTO public.audit_logs(tenant_id, actor_type, actor_id, action, entity_type, entity_id, metadata)
  VALUES (_tenant_id, 'super_admin', auth.uid(), _action, _entity_type, _entity_id, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;