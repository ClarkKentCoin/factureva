-- =========================================================
-- Facturly: multi-tenant SaaS foundation (France-first)
-- =========================================================

-- ---------- ENUMS ----------
create type public.app_role as enum ('super_admin');
create type public.tenant_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.interface_language as enum ('fr', 'en', 'ru');
create type public.document_language as enum ('fr', 'en', 'ru');
create type public.country_code as enum ('FR');
create type public.legal_entity_type as enum ('individual', 'company');
create type public.fr_legal_form as enum (
  'micro_entrepreneur','ei','eirl','eurl','sarl','sas','sasu','sa','sci','association','other'
);
create type public.fr_seller_profile as enum (
  'micro_bnc','micro_bic_services','micro_bic_goods','reel_simplifie','reel_normal','franchise_base_tva','other'
);
create type public.vat_regime as enum ('franchise_base','reel_simplifie','reel_normal','not_applicable');
create type public.activity_category as enum (
  'web_design','web_development','consulting','digital_services','goods_sales','ecommerce','physical_production','mixed','other'
);
create type public.item_type as enum ('service','good','mixed');
create type public.audit_actor_type as enum ('user','super_admin','system');

-- ---------- PROFILES ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  interface_language public.interface_language not null default 'fr',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- PLATFORM ROLES (super_admin only; tenant roles live elsewhere) ----------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

-- ---------- TENANTS ----------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  default_country public.country_code not null default 'FR',
  default_document_language public.document_language not null default 'fr',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.tenant_role not null default 'member',
  created_at timestamptz not null default now(),
  unique(tenant_id, user_id)
);
create index on public.tenant_members(user_id);
create index on public.tenant_members(tenant_id);

-- ---------- SECURITY DEFINER HELPERS (avoid RLS recursion) ----------
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_tenant_member(_tenant_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tenant_members where tenant_id = _tenant_id and user_id = _user_id)
$$;

create or replace function public.tenant_role_of(_tenant_id uuid, _user_id uuid)
returns public.tenant_role language sql stable security definer set search_path = public as $$
  select role from public.tenant_members where tenant_id = _tenant_id and user_id = _user_id limit 1
$$;

create or replace function public.is_tenant_admin(_tenant_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tenant_members
    where tenant_id = _tenant_id and user_id = _user_id and role in ('owner','admin')
  )
$$;

-- ---------- PLANS / FEATURES / SUBSCRIPTIONS ----------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,            -- e.g. 'free','beta','pro'
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.features (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,             -- e.g. 'invoices.create'
  name text not null,
  description text,
  is_limit boolean not null default false  -- true = numeric limit, false = boolean entitlement
);

create table public.plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  feature_id uuid not null references public.features(id) on delete cascade,
  enabled boolean not null default true,
  limit_value bigint,
  unique(plan_id, feature_id)
);

create table public.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status text not null default 'active', -- active|trialing|past_due|canceled
  started_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.tenant_subscriptions(tenant_id);

create table public.tenant_feature_overrides (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  feature_id uuid not null references public.features(id) on delete cascade,
  enabled boolean,
  limit_value bigint,
  reason text,
  created_at timestamptz not null default now(),
  unique(tenant_id, feature_id)
);

create table public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  feature_key text not null,
  period_start date not null,
  period_end date not null,
  value bigint not null default 0,
  unique(tenant_id, feature_key, period_start)
);

-- ---------- COUNTRY PACK (France-first) ----------
create table public.country_profiles (
  id uuid primary key default gen_random_uuid(),
  code public.country_code not null unique,
  name text not null,
  default_currency text not null default 'EUR',
  default_locale text not null default 'fr-FR',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.legal_phrases (
  id uuid primary key default gen_random_uuid(),
  country_code public.country_code not null,
  key text not null,                    -- e.g. 'tva_non_applicable_art293B'
  language public.document_language not null,
  text text not null,
  conditions jsonb not null default '{}'::jsonb, -- which legal_form/vat_regime/seller_profile triggers it
  unique(country_code, key, language)
);

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  country_code public.country_code not null,
  kind text not null,                   -- 'invoice','quote','credit_note'
  code text not null,                   -- 'fr_default'
  name text not null,
  config jsonb not null default '{}'::jsonb,
  unique(country_code, kind, code)
);

create table public.translations (
  id uuid primary key default gen_random_uuid(),
  namespace text not null,              -- 'app','legal','docs'
  key text not null,
  language public.interface_language not null,
  value text not null,
  unique(namespace, key, language)
);

-- ---------- COMPANIES (tenant company profile) ----------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  country_code public.country_code not null default 'FR',
  legal_entity_type public.legal_entity_type not null default 'individual',
  fr_legal_form public.fr_legal_form,
  fr_seller_profile public.fr_seller_profile,
  company_name text not null,
  legal_name text,
  siren text,
  siret text,
  vat_regime public.vat_regime not null default 'franchise_base',
  vat_number text,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country text default 'France',
  logo_url text,
  default_document_language public.document_language not null default 'fr',
  payment_defaults jsonb not null default '{}'::jsonb,
  invoice_defaults jsonb not null default '{}'::jsonb,
  regulated_activity_flags jsonb not null default '{}'::jsonb,
  legal_requirements jsonb not null default '{}'::jsonb, -- output of Required Invoice Logic layer
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.companies(tenant_id);

-- ---------- ACTIVITIES (tenant declared activities) ----------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  category public.activity_category not null default 'other',
  code text,
  description text,
  is_active boolean not null default true,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.activities(tenant_id);

-- ---------- ITEMS / SERVICES CATALOG ----------
create table public.items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete set null,
  name text not null,
  description text,
  item_type public.item_type not null default 'service',
  default_unit text default 'unit',
  default_unit_price numeric(14,2) default 0,
  default_vat_rate numeric(5,2) default 20.00,
  default_document_behavior jsonb not null default '{}'::jsonb,
  accounting_category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.items(tenant_id);

-- ---------- AUDIT LOGS ----------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade, -- null for platform-level
  actor_type public.audit_actor_type not null default 'user',
  actor_id uuid,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_logs(tenant_id);
create index on public.audit_logs(actor_id);

-- ---------- SIGNUP TRIGGER: profile auto-create ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- updated_at triggers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_tenants_updated before update on public.tenants
  for each row execute function public.set_updated_at();
create trigger trg_companies_updated before update on public.companies
  for each row execute function public.set_updated_at();

-- ---------- ENABLE RLS ----------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.plans enable row level security;
alter table public.features enable row level security;
alter table public.plan_features enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.tenant_feature_overrides enable row level security;
alter table public.usage_counters enable row level security;
alter table public.country_profiles enable row level security;
alter table public.legal_phrases enable row level security;
alter table public.document_templates enable row level security;
alter table public.translations enable row level security;
alter table public.companies enable row level security;
alter table public.activities enable row level security;
alter table public.items enable row level security;
alter table public.audit_logs enable row level security;

-- ---------- POLICIES ----------
-- profiles
create policy "profiles_self_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'super_admin'));
create policy "profiles_self_update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_self_insert" on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- user_roles: only super_admin can read/manage; never user-writable
create policy "user_roles_super_select" on public.user_roles for select to authenticated
  using (public.has_role(auth.uid(),'super_admin'));

-- tenants
create policy "tenants_member_select" on public.tenants for select to authenticated
  using (public.is_tenant_member(id, auth.uid()) or public.has_role(auth.uid(),'super_admin'));
create policy "tenants_create" on public.tenants for insert to authenticated
  with check (auth.uid() = created_by);
create policy "tenants_admin_update" on public.tenants for update to authenticated
  using (public.is_tenant_admin(id, auth.uid()) or public.has_role(auth.uid(),'super_admin'));

-- tenant_members
create policy "tm_self_or_admin_select" on public.tenant_members for select to authenticated
  using (user_id = auth.uid() or public.is_tenant_admin(tenant_id, auth.uid()) or public.has_role(auth.uid(),'super_admin'));
create policy "tm_admin_insert" on public.tenant_members for insert to authenticated
  with check (public.is_tenant_admin(tenant_id, auth.uid()) or public.has_role(auth.uid(),'super_admin'));
create policy "tm_admin_update" on public.tenant_members for update to authenticated
  using (public.is_tenant_admin(tenant_id, auth.uid()) or public.has_role(auth.uid(),'super_admin'));
create policy "tm_admin_delete" on public.tenant_members for delete to authenticated
  using (public.is_tenant_admin(tenant_id, auth.uid()) or public.has_role(auth.uid(),'super_admin'));

-- plans / features / plan_features: world-readable to authed users; only super_admin writes
create policy "plans_read" on public.plans for select to authenticated using (true);
create policy "features_read" on public.features for select to authenticated using (true);
create policy "plan_features_read" on public.plan_features for select to authenticated using (true);
create policy "plans_super_write" on public.plans for all to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));
create policy "features_super_write" on public.features for all to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));
create policy "plan_features_super_write" on public.plan_features for all to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));

-- tenant_subscriptions: members read; super_admin write
create policy "subs_member_read" on public.tenant_subscriptions for select to authenticated
  using (public.is_tenant_member(tenant_id, auth.uid()) or public.has_role(auth.uid(),'super_admin'));
create policy "subs_super_write" on public.tenant_subscriptions for all to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));

-- tenant_feature_overrides: members read; super_admin write
create policy "tfo_member_read" on public.tenant_feature_overrides for select to authenticated
  using (public.is_tenant_member(tenant_id, auth.uid()) or public.has_role(auth.uid(),'super_admin'));
create policy "tfo_super_write" on public.tenant_feature_overrides for all to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));

-- usage_counters: members read; system writes via service role (no user policy)
create policy "uc_member_read" on public.usage_counters for select to authenticated
  using (public.is_tenant_member(tenant_id, auth.uid()) or public.has_role(auth.uid(),'super_admin'));

-- country_profiles / legal_phrases / document_templates / translations: read-all, super write
create policy "cp_read" on public.country_profiles for select to authenticated using (true);
create policy "cp_super_write" on public.country_profiles for all to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));
create policy "lp_read" on public.legal_phrases for select to authenticated using (true);
create policy "lp_super_write" on public.legal_phrases for all to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));
create policy "dt_read" on public.document_templates for select to authenticated using (true);
create policy "dt_super_write" on public.document_templates for all to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));
create policy "tr_read" on public.translations for select to authenticated using (true);
create policy "tr_super_write" on public.translations for all to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));

-- companies: tenant-scoped
create policy "companies_member_select" on public.companies for select to authenticated
  using (public.is_tenant_member(tenant_id, auth.uid()) or public.has_role(auth.uid(),'super_admin'));
create policy "companies_member_insert" on public.companies for insert to authenticated
  with check (public.is_tenant_member(tenant_id, auth.uid()));
create policy "companies_admin_update" on public.companies for update to authenticated
  using (public.is_tenant_admin(tenant_id, auth.uid()));
create policy "companies_admin_delete" on public.companies for delete to authenticated
  using (public.is_tenant_admin(tenant_id, auth.uid()));

-- activities: tenant-scoped
create policy "activities_member_select" on public.activities for select to authenticated
  using (public.is_tenant_member(tenant_id, auth.uid()) or public.has_role(auth.uid(),'super_admin'));
create policy "activities_member_write" on public.activities for all to authenticated
  using (public.is_tenant_member(tenant_id, auth.uid())) with check (public.is_tenant_member(tenant_id, auth.uid()));

-- items: tenant-scoped
create policy "items_member_select" on public.items for select to authenticated
  using (public.is_tenant_member(tenant_id, auth.uid()) or public.has_role(auth.uid(),'super_admin'));
create policy "items_member_write" on public.items for all to authenticated
  using (public.is_tenant_member(tenant_id, auth.uid())) with check (public.is_tenant_member(tenant_id, auth.uid()));

-- audit_logs: members read tenant logs; super_admin reads all; inserts only via service role
create policy "audit_member_read" on public.audit_logs for select to authenticated
  using (
    (tenant_id is not null and public.is_tenant_member(tenant_id, auth.uid()))
    or public.has_role(auth.uid(),'super_admin')
  );

-- ---------- SEED: country pack + plans + features ----------
insert into public.country_profiles (code, name, default_currency, default_locale, config)
values ('FR','France','EUR','fr-FR',
  jsonb_build_object(
    'siren_required_for', jsonb_build_array('ei','eurl','sarl','sas','sasu','sa','sci','micro_entrepreneur'),
    'vat_number_required_when', jsonb_build_object('vat_regime_in', jsonb_build_array('reel_simplifie','reel_normal'))
  ));

insert into public.plans (code, name, description) values
  ('free','Free','Free starter plan'),
  ('beta','Beta','Beta access plan');

insert into public.features (key, name, description, is_limit) values
  ('invoices.create','Create invoices',null,false),
  ('invoices.pdf_export','PDF export',null,false),
  ('invoices.send_email','Send invoice by email',null,false),
  ('clients.manage','Manage clients',null,false),
  ('company.manage','Manage company profile',null,false),
  ('users.invite','Invite users',null,false),
  ('superadmin.access','Superadmin access',null,false),
  ('country.fr','France country pack',null,false),
  ('limit.max_users','Max users per tenant',null,true),
  ('limit.max_clients','Max clients per tenant',null,true),
  ('limit.max_invoices_per_month','Max invoices per month',null,true),
  ('limit.max_storage_mb','Max storage (MB)',null,true),
  ('limit.max_legal_entities','Max legal entities (companies)',null,true);

-- Free plan defaults
insert into public.plan_features (plan_id, feature_id, enabled, limit_value)
select p.id, f.id, true, case f.key
    when 'limit.max_users' then 2
    when 'limit.max_clients' then 25
    when 'limit.max_invoices_per_month' then 10
    when 'limit.max_storage_mb' then 100
    when 'limit.max_legal_entities' then 1
    else null end
from public.plans p, public.features f
where p.code = 'free' and f.key in (
  'invoices.create','invoices.pdf_export','clients.manage','company.manage','country.fr',
  'limit.max_users','limit.max_clients','limit.max_invoices_per_month','limit.max_storage_mb','limit.max_legal_entities'
);

-- Beta plan: everything except superadmin
insert into public.plan_features (plan_id, feature_id, enabled, limit_value)
select p.id, f.id, true, case f.key
    when 'limit.max_users' then 10
    when 'limit.max_clients' then 1000
    when 'limit.max_invoices_per_month' then 1000
    when 'limit.max_storage_mb' then 5000
    when 'limit.max_legal_entities' then 5
    else null end
from public.plans p, public.features f
where p.code = 'beta' and f.key <> 'superadmin.access';