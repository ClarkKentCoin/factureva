
-- 1. Plan / feature alignment
DO $$
DECLARE
  v_free uuid; v_pro uuid; v_business uuid; v_beta uuid;
  v_l_users uuid; v_f_invite uuid;
BEGIN
  SELECT id INTO v_free     FROM public.plans WHERE code = 'free';
  SELECT id INTO v_pro      FROM public.plans WHERE code = 'pro';
  SELECT id INTO v_business FROM public.plans WHERE code = 'business';
  SELECT id INTO v_beta     FROM public.plans WHERE code = 'beta';
  SELECT id INTO v_l_users  FROM public.features WHERE key = 'limit.max_users';
  SELECT id INTO v_f_invite FROM public.features WHERE key = 'users.invite';

  IF v_l_users IS NOT NULL THEN
    INSERT INTO public.plan_features (plan_id, feature_id, enabled, limit_value)
    VALUES (v_free, v_l_users, true, 1)
    ON CONFLICT DO NOTHING;
    UPDATE public.plan_features SET limit_value = 1 WHERE plan_id = v_free     AND feature_id = v_l_users;
    UPDATE public.plan_features SET limit_value = 2 WHERE plan_id = v_pro      AND feature_id = v_l_users;
    UPDATE public.plan_features SET limit_value = 5 WHERE plan_id = v_business AND feature_id = v_l_users;
    UPDATE public.plan_features SET limit_value = 5 WHERE plan_id = v_beta     AND feature_id = v_l_users;
  END IF;

  IF v_f_invite IS NOT NULL THEN
    INSERT INTO public.plan_features (plan_id, feature_id, enabled)
    VALUES (v_pro, v_f_invite, true), (v_business, v_f_invite, true), (v_beta, v_f_invite, true)
    ON CONFLICT DO NOTHING;
    UPDATE public.plan_features SET enabled = true
      WHERE feature_id = v_f_invite AND plan_id IN (v_pro, v_business, v_beta);

    INSERT INTO public.plan_features (plan_id, feature_id, enabled)
    VALUES (v_free, v_f_invite, false)
    ON CONFLICT DO NOTHING;
    UPDATE public.plan_features SET enabled = false
      WHERE feature_id = v_f_invite AND plan_id = v_free;
  END IF;
END $$;

-- 2. tenant_invitations
CREATE TABLE IF NOT EXISTS public.tenant_invitations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email         text NOT NULL,
  role          public.tenant_role NOT NULL DEFAULT 'member',
  invited_by    uuid,
  token_hash    text NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','revoked','expired')),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_by   uuid,
  accepted_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_invitations_token_hash_uq
  ON public.tenant_invitations(token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_invitations_one_pending_per_email
  ON public.tenant_invitations (tenant_id, lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS tenant_invitations_tenant_idx
  ON public.tenant_invitations(tenant_id);

DROP TRIGGER IF EXISTS tenant_invitations_set_updated_at ON public.tenant_invitations;
CREATE TRIGGER tenant_invitations_set_updated_at
  BEFORE UPDATE ON public.tenant_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ti_admin_select ON public.tenant_invitations;
CREATE POLICY ti_admin_select ON public.tenant_invitations
  FOR SELECT TO authenticated
  USING (public.is_tenant_admin(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS ti_admin_insert ON public.tenant_invitations;
CREATE POLICY ti_admin_insert ON public.tenant_invitations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(tenant_id, auth.uid()) AND invited_by = auth.uid());

DROP POLICY IF EXISTS ti_admin_update ON public.tenant_invitations;
CREATE POLICY ti_admin_update ON public.tenant_invitations
  FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(tenant_id, auth.uid()))
  WITH CHECK (public.is_tenant_admin(tenant_id, auth.uid()));

-- 3. Public lookup by token hash (no raw token in DB)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token_hash(_token_hash text)
RETURNS TABLE (
  id uuid, tenant_id uuid, tenant_name text,
  email text, role public.tenant_role, status text, expires_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, i.tenant_id, t.name, i.email, i.role, i.status, i.expires_at
  FROM public.tenant_invitations i
  JOIN public.tenants t ON t.id = i.tenant_id
  WHERE i.token_hash = _token_hash
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token_hash(text) TO anon, authenticated;

-- 4. Accept invitation (atomic, seat-limit enforced)
CREATE OR REPLACE FUNCTION public.accept_invitation(_token_hash text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_inv RECORD;
  v_seat_limit bigint;
  v_current_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  SELECT * INTO v_inv FROM public.tenant_invitations
   WHERE token_hash = _token_hash FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'invitation_%', v_inv.status; END IF;
  IF v_inv.expires_at < now() THEN
    UPDATE public.tenant_invitations SET status = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'invitation_expired';
  END IF;
  IF lower(v_email) <> lower(v_inv.email) THEN
    RAISE EXCEPTION 'invitation_email_mismatch';
  END IF;

  IF EXISTS (SELECT 1 FROM public.tenant_members WHERE tenant_id = v_inv.tenant_id AND user_id = v_uid) THEN
    UPDATE public.tenant_invitations
       SET status = 'accepted', accepted_by = v_uid, accepted_at = now()
     WHERE id = v_inv.id;
    RETURN v_inv.tenant_id;
  END IF;

  SELECT COALESCE(o.limit_value, pf.limit_value) INTO v_seat_limit
  FROM public.tenant_subscriptions s
  JOIN public.features f ON f.key = 'limit.max_users'
  LEFT JOIN public.plan_features pf ON pf.plan_id = s.plan_id AND pf.feature_id = f.id
  LEFT JOIN public.tenant_feature_overrides o ON o.tenant_id = s.tenant_id AND o.feature_id = f.id
  WHERE s.tenant_id = v_inv.tenant_id AND s.status = 'active'
  ORDER BY s.started_at DESC LIMIT 1;

  SELECT count(*) INTO v_current_count
  FROM public.tenant_members WHERE tenant_id = v_inv.tenant_id;

  IF v_seat_limit IS NOT NULL AND v_current_count >= v_seat_limit THEN
    RAISE EXCEPTION 'seat_limit_reached';
  END IF;

  INSERT INTO public.tenant_members (tenant_id, user_id, role)
  VALUES (v_inv.tenant_id, v_uid, v_inv.role);

  UPDATE public.tenant_invitations
     SET status = 'accepted', accepted_by = v_uid, accepted_at = now()
   WHERE id = v_inv.id;

  RETURN v_inv.tenant_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;
