-- Create nature_of_activity enum
do $$ begin
  create type public.nature_of_activity as enum ('commerciale','artisanale','liberale','agricole');
exception when duplicate_object then null; end $$;

-- Add new columns
alter table public.activities
  add column if not exists nature_of_activity public.nature_of_activity,
  add column if not exists naf_section_code text,
  add column if not exists naf_section_label text,
  add column if not exists naf_division_code text,
  add column if not exists naf_division_label text;

-- Best-effort migration of legacy category -> nature_of_activity
update public.activities set nature_of_activity = case
  when category in ('web_design','web_development','consulting','digital_services') then 'liberale'::public.nature_of_activity
  when category in ('goods_sales','ecommerce','mixed') then 'commerciale'::public.nature_of_activity
  when category in ('physical_production') then 'artisanale'::public.nature_of_activity
  else 'commerciale'::public.nature_of_activity
end
where nature_of_activity is null;

-- Backfill default NAF section as 'S - Autres activités de services' so existing rows are valid for new required UI
update public.activities
  set naf_section_code = 'S',
      naf_section_label = 'Autres activités de services'
where naf_section_code is null;

-- Make new fields required going forward
alter table public.activities
  alter column nature_of_activity set not null,
  alter column naf_section_code set not null,
  alter column naf_section_label set not null;

-- Drop legacy default on category to stop forcing 'other' on new inserts
alter table public.activities alter column category drop not null;
alter table public.activities alter column category drop default;