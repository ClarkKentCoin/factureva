-- Billing cleanup: align plan_features with product packaging.
-- Free gains email send. Pro keeps current. Business keeps everything + multi-entities & limits adjusted.
-- Beta is normalized to mirror Pro (>=) so it never looks weaker.

DO $$
DECLARE
  v_free uuid;
  v_pro uuid;
  v_business uuid;
  v_beta uuid;
  v_f_send uuid;
  v_f_quotes uuid;
  v_f_reminders uuid;
  v_f_branding uuid;
  v_f_credit uuid;
  v_f_reports uuid;
  v_f_multi uuid;
  v_f_api uuid;
  v_l_clients uuid;
  v_l_invoices uuid;
  v_l_users uuid;
  v_l_entities uuid;
BEGIN
  SELECT id INTO v_free     FROM public.plans WHERE code = 'free';
  SELECT id INTO v_pro      FROM public.plans WHERE code = 'pro';
  SELECT id INTO v_business FROM public.plans WHERE code = 'business';
  SELECT id INTO v_beta     FROM public.plans WHERE code = 'beta';

  SELECT id INTO v_f_send      FROM public.features WHERE key = 'invoices.send_email';
  SELECT id INTO v_f_quotes    FROM public.features WHERE key = 'quotes.create';
  SELECT id INTO v_f_reminders FROM public.features WHERE key = 'reminders.send';
  SELECT id INTO v_f_branding  FROM public.features WHERE key = 'branding.custom';
  SELECT id INTO v_f_credit    FROM public.features WHERE key = 'credit_notes.create';
  SELECT id INTO v_f_reports   FROM public.features WHERE key = 'reports.advanced';
  SELECT id INTO v_f_multi     FROM public.features WHERE key = 'company.multiple_entities';
  SELECT id INTO v_f_api       FROM public.features WHERE key = 'api.access';

  SELECT id INTO v_l_clients   FROM public.features WHERE key = 'limit.max_clients';
  SELECT id INTO v_l_invoices  FROM public.features WHERE key = 'limit.max_invoices_per_month';
  SELECT id INTO v_l_users     FROM public.features WHERE key = 'limit.max_users';
  SELECT id INTO v_l_entities  FROM public.features WHERE key = 'limit.max_legal_entities';

  -- FREE: add invoices.send_email (basic email send is part of starter plan)
  IF v_free IS NOT NULL AND v_f_send IS NOT NULL THEN
    INSERT INTO public.plan_features (plan_id, feature_id, enabled)
    VALUES (v_free, v_f_send, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- PRO: ensure credit_notes.create is enabled
  IF v_pro IS NOT NULL AND v_f_credit IS NOT NULL THEN
    INSERT INTO public.plan_features (plan_id, feature_id, enabled)
    VALUES (v_pro, v_f_credit, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- BUSINESS: bump limits to clearer hierarchy
  UPDATE public.plan_features SET limit_value = 10000
    WHERE plan_id = v_business AND feature_id = v_l_clients;
  UPDATE public.plan_features SET limit_value = 10000
    WHERE plan_id = v_business AND feature_id = v_l_invoices;
  UPDATE public.plan_features SET limit_value = 50
    WHERE plan_id = v_business AND feature_id = v_l_users;
  UPDATE public.plan_features SET limit_value = 25
    WHERE plan_id = v_business AND feature_id = v_l_entities;

  -- BETA: enable advanced features so it never looks weaker than Pro
  IF v_beta IS NOT NULL THEN
    INSERT INTO public.plan_features (plan_id, feature_id, enabled)
    VALUES
      (v_beta, v_f_credit,    true),
      (v_beta, v_f_reports,   true),
      (v_beta, v_f_multi,     true),
      (v_beta, v_f_api,       true)
    ON CONFLICT DO NOTHING;

    -- Beta limits >= Pro
    UPDATE public.plan_features SET limit_value = 10000 WHERE plan_id = v_beta AND feature_id = v_l_clients;
    UPDATE public.plan_features SET limit_value = 10000 WHERE plan_id = v_beta AND feature_id = v_l_invoices;
    UPDATE public.plan_features SET limit_value = 50    WHERE plan_id = v_beta AND feature_id = v_l_users;
    UPDATE public.plan_features SET limit_value = 25    WHERE plan_id = v_beta AND feature_id = v_l_entities;
  END IF;

  -- Neutralize seeded plan descriptions so the UI fully owns localized copy.
  UPDATE public.plans SET description = NULL
    WHERE code IN ('free', 'pro', 'business', 'beta');
END $$;