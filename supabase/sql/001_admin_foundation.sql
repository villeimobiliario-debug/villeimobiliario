-- VILLE Imobiliario | Fundacao administrativa | Versao 001
-- Executar apenas no projeto Supabase do VILLE Imobiliario.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated;

create table app_private.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on app_private.platform_admins from public, anon, authenticated;

create or replace function app_private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from app_private.platform_admins pa
      where pa.user_id = (select auth.uid())
    );
$$;
revoke all on function app_private.is_platform_admin() from public, anon;
grant execute on function app_private.is_platform_admin() to authenticated;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  state text not null default 'enabled' check (state in ('enabled', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','agent')),
  created_at timestamptz not null default now(),
  primary key(tenant_id, user_id)
);
create index tenant_members_user_id_idx on public.tenant_members(user_id, tenant_id);

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  monthly_price_cents integer not null check (monthly_price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.subscriptions (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status text not null default 'trial' check (status in ('trial','active','past_due','suspended','cancelled')),
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '7 days'),
  paid_until date,
  next_due_on date,
  grace_days integer not null default 5 check (grace_days between 0 and 31),
  updated_at timestamptz not null default now(),
  check (trial_ends_at > trial_started_at)
);
create index subscriptions_due_idx on public.subscriptions(next_due_on) where next_due_on is not null;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cycle_start date not null,
  cycle_end date not null,
  due_on date not null,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'open' check (status in ('open','paid','void')),
  created_at timestamptz not null default now(),
  unique (tenant_id, cycle_start),
  unique (id, tenant_id),
  check (cycle_end >= cycle_start)
);
create index invoices_tenant_due_idx on public.invoices(tenant_id, due_on);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  invoice_id uuid not null,
  amount_cents integer not null check (amount_cents > 0),
  state text not null default 'submitted' check (state in ('submitted','approved','rejected')),
  proof_path text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  constraint payments_invoice_tenant_fk
    foreign key(invoice_id, tenant_id) references public.invoices(id, tenant_id),
  check ((state <> 'approved') or (reviewed_at is not null and reviewed_by is not null))
);
create index payments_tenant_idx on public.payments(tenant_id, submitted_at desc);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_tenant_created_idx on public.audit_events(tenant_id, created_at desc);

create table public.platform_settings (
  singleton boolean primary key default true check (singleton),
  trial_days smallint not null default 7 check (trial_days between 1 and 30),
  grace_days smallint not null default 5 check (grace_days between 0 and 31),
  pix_key text,
  pix_recipient text,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings(singleton,trial_days,grace_days) values(true,7,5);

-- Uma nova imobiliaria so pode ser criada pelo backend autenticado,
-- que validara unicidade, trial e regras anti-abuso.
-- Nunca permitir criacao de tenants via INSERT direto do navegador.
alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.audit_events enable row level security;
alter table public.platform_settings enable row level security;

revoke all on public.tenants, public.tenant_members, public.subscription_plans,
  public.subscriptions, public.invoices, public.payments, public.audit_events,
  public.platform_settings from anon, authenticated;

grant select on public.tenants, public.tenant_members, public.subscription_plans,
  public.subscriptions, public.invoices, public.payments to authenticated;
grant select, insert, update, delete on public.tenants, public.tenant_members,
  public.subscription_plans, public.subscriptions, public.invoices,
  public.payments to authenticated;
grant select on public.audit_events to authenticated;
grant select, update on public.platform_settings to authenticated;

create policy tenant_members_self_or_admin on public.tenant_members
for select to authenticated
using (user_id = (select auth.uid()) or (select app_private.is_platform_admin()));
create policy tenant_members_admin_write on public.tenant_members
for all to authenticated
using ((select app_private.is_platform_admin()))
with check ((select app_private.is_platform_admin()));

create policy tenants_read_member_or_admin on public.tenants
for select to authenticated
using (
  (select app_private.is_platform_admin())
  or exists(select 1 from public.tenant_members m
    where m.tenant_id = tenants.id and m.user_id = (select auth.uid()))
);
create policy tenants_admin_write on public.tenants
for all to authenticated
using ((select app_private.is_platform_admin()))
with check ((select app_private.is_platform_admin()));

create policy plans_read_active_or_admin on public.subscription_plans
for select to authenticated
using (active or (select app_private.is_platform_admin()));
create policy plans_admin_write on public.subscription_plans
for all to authenticated
using ((select app_private.is_platform_admin()))
with check ((select app_private.is_platform_admin()));

create policy subscriptions_read_member_or_admin on public.subscriptions
for select to authenticated
using (
  (select app_private.is_platform_admin())
  or exists(select 1 from public.tenant_members m
    where m.tenant_id = subscriptions.tenant_id
    and m.user_id = (select auth.uid()))
);
create policy subscriptions_admin_write on public.subscriptions
for all to authenticated
using ((select app_private.is_platform_admin()))
with check ((select app_private.is_platform_admin()));

create policy invoices_read_member_or_admin on public.invoices
for select to authenticated
using (
  (select app_private.is_platform_admin())
  or exists(select 1 from public.tenant_members m
    where m.tenant_id = invoices.tenant_id
    and m.user_id = (select auth.uid()))
);
create policy invoices_admin_write on public.invoices
for all to authenticated
using ((select app_private.is_platform_admin()))
with check ((select app_private.is_platform_admin()));

create policy payments_read_member_or_admin on public.payments
for select to authenticated
using (
  (select app_private.is_platform_admin())
  or exists(select 1 from public.tenant_members m
    where m.tenant_id = payments.tenant_id
    and m.user_id = (select auth.uid()))
);
create policy payments_admin_write on public.payments
for all to authenticated
using ((select app_private.is_platform_admin()))
with check ((select app_private.is_platform_admin()));

create policy audit_admin_read on public.audit_events
for select to authenticated
using ((select app_private.is_platform_admin()));
create policy settings_admin_read on public.platform_settings
for select to authenticated
using ((select app_private.is_platform_admin()));
create policy settings_admin_update on public.platform_settings
for update to authenticated
using ((select app_private.is_platform_admin()))
with check ((select app_private.is_platform_admin()));

-- Revogacao explicita de acessos publicos a tabelas e rotinas.
revoke all on public.tenants, public.tenant_members, public.subscription_plans,
  public.subscriptions, public.invoices, public.payments, public.audit_events,
  public.platform_settings from anon;
