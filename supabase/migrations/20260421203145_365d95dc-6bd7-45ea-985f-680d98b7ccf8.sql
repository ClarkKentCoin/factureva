create or replace function public.create_initial_tenant(_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_tenant_id uuid;
  free_plan_id uuid;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  if _name is null or length(btrim(_name)) = 0 then
    raise exception 'invalid_name';
  end if;

  insert into public.tenants (name, created_by, default_country, default_document_language)
  values (btrim(_name), uid, 'FR', 'fr')
  returning id into new_tenant_id;

  insert into public.tenant_members (tenant_id, user_id, role)
  values (new_tenant_id, uid, 'owner');

  select id into free_plan_id from public.plans where code = 'free' limit 1;
  if free_plan_id is not null then
    insert into public.tenant_subscriptions (tenant_id, plan_id, status)
    values (new_tenant_id, free_plan_id, 'active');
  end if;

  return new_tenant_id;
end;
$$;

revoke all on function public.create_initial_tenant(text) from public;
grant execute on function public.create_initial_tenant(text) to authenticated;