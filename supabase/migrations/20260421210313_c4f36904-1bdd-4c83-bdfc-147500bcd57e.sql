-- Enum for client type
do $$ begin
  create type public.client_type as enum ('company', 'individual');
exception when duplicate_object then null; end $$;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_type public.client_type not null default 'company',
  display_name text not null,
  legal_name text,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country_code public.country_code not null default 'FR',
  vat_number text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_tenant_idx on public.clients(tenant_id);
create index if not exists clients_tenant_active_idx on public.clients(tenant_id, is_active);

alter table public.clients enable row level security;

create policy clients_member_select on public.clients
  for select to authenticated
  using (public.is_tenant_member(tenant_id, auth.uid()) or public.has_role(auth.uid(), 'super_admin'));

create policy clients_member_insert on public.clients
  for insert to authenticated
  with check (public.is_tenant_member(tenant_id, auth.uid()));

create policy clients_member_update on public.clients
  for update to authenticated
  using (public.is_tenant_member(tenant_id, auth.uid()))
  with check (public.is_tenant_member(tenant_id, auth.uid()));

create policy clients_admin_delete on public.clients
  for delete to authenticated
  using (public.is_tenant_admin(tenant_id, auth.uid()));

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();