-- VILLE Imobiliario / 005: seguranca e primeiro modulo operacional
-- Exclusivo ao projeto VILLE: sem modificar a gestao administrativa existente.
-- O primeiro proprietario associa sua conta somente se possui o email confirmado do cadastro.

create or replace function app_private.claim_tenant_owner_impl(p_slug text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_email text; v_tenant_id uuid;
begin
  if v_user_id is null then raise exception 'Autenticacao obrigatoria' using errcode='42501'; end if;
  select lower(email) into v_email from auth.users
    where id=v_user_id and email_confirmed_at is not null and deleted_at is null;
  if v_email is null then
    raise exception 'Confirme o e-mail antes de vincular sua imobiliaria' using errcode='42501';
  end if;
  select id into v_tenant_id from public.tenants
    where slug=p_slug and lower(contact_email)=v_email and state='enabled' for update;
  if v_tenant_id is null then
    raise exception 'Nenhuma imobiliaria disponivel para este e-mail e identificador' using errcode='42501';
  end if;
  if exists(select 1 from public.tenant_members where tenant_id=v_tenant_id and role='owner') then
    if exists(select 1 from public.tenant_members where tenant_id=v_tenant_id and user_id=v_user_id and role='owner') then
      return v_tenant_id;
    end if;
    raise exception 'Esta imobiliaria ja possui um proprietario cadastrado' using errcode='42501';
  end if;
  insert into public.tenant_members(tenant_id,user_id,role)
    values(v_tenant_id,v_user_id,'owner');
  insert into public.audit_events(actor_id,tenant_id,action,entity_type,entity_id,details)
    values(v_user_id,v_tenant_id,'tenant.owner_claimed','tenant',v_tenant_id::text,
      jsonb_build_object('email',v_email));
  return v_tenant_id;
end;
$$;
revoke all on function app_private.claim_tenant_owner_impl(text) from public,anon;
grant execute on function app_private.claim_tenant_owner_impl(text) to authenticated;
create or replace function public.claim_tenant_owner(p_slug text)
returns uuid language sql security invoker set search_path=''
as $$ select app_private.claim_tenant_owner_impl(p_slug) $$;
revoke all on function public.claim_tenant_owner(text) from public,anon;
grant execute on function public.claim_tenant_owner(text) to authenticated;

-- Nenhum dado operacional aparece se assinatura nao permite usar o software.
-- Um periodo de graca preserva o uso ate cinco dias apos o vencimento,
-- desde que nao exista suspensao administrativa.
create or replace function app_private.tenant_can_use(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
select auth.uid() is not null
 and exists (
  select 1
  from public.tenant_members m
  join public.tenants t on t.id=m.tenant_id
  join public.subscriptions s on s.tenant_id=t.id
  where m.user_id=auth.uid() and m.tenant_id=p_tenant_id
   and t.state='enabled'
   and (
     (s.status='trial' and now() <= s.trial_ends_at + make_interval(days=>s.grace_days))
     or (s.status in ('active','past_due') and
         ((s.paid_until is not null and s.paid_until >= current_date)
           or (s.next_due_on is not null and current_date <= s.next_due_on+s.grace_days)))
   )
 );
$$;
revoke all on function app_private.tenant_can_use(uuid) from public,anon;
grant execute on function app_private.tenant_can_use(uuid) to authenticated;

create or replace function app_private.tenant_can_manage(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
select app_private.tenant_can_use(p_tenant_id) and exists(
 select 1 from public.tenant_members
 where tenant_id=p_tenant_id and user_id=auth.uid() and role in ('owner','manager')
);
$$;
revoke all on function app_private.tenant_can_manage(uuid) from public,anon;
grant execute on function app_private.tenant_can_manage(uuid) to authenticated;

create table public.properties (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 title text not null check (char_length(trim(title)) between 3 and 160),
 property_type text not null default 'house' check(property_type in ('house','apartment','land','commercial','rural','other')),
 purpose text not null check (purpose in ('sale','rent','both')),
 status text not null default 'available' check(status in ('available','reserved','rented','sold','inactive')),
 city text not null check(char_length(trim(city)) between 2 and 100),
 neighborhood text,
 address_note text,
 description text,
 sale_price_cents bigint check(sale_price_cents>=0),
 rental_price_cents bigint check(rental_price_cents>=0),
 bedrooms smallint not null default 0 check(bedrooms between 0 and 100),
 bathrooms smallint not null default 0 check(bathrooms between 0 and 100),
 parking_spaces smallint not null default 0 check(parking_spaces between 0 and 100),
 area_m2 numeric(10,2) check(area_m2>=0),
 published boolean not null default false,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,tenant_id),
 check((purpose='sale' and sale_price_cents is not null)
    or (purpose='rent' and rental_price_cents is not null)
    or (purpose='both' and sale_price_cents is not null and rental_price_cents is not null))
);
create index properties_tenant_status_idx on public.properties(tenant_id,status,created_at desc);
create index properties_tenant_published_idx on public.properties(tenant_id,published) where published;
create index properties_created_by_idx on public.properties(created_by);

create table public.contacts (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 full_name text not null check(char_length(trim(full_name)) between 2 and 160),
 kind text not null default 'lead' check(kind in ('lead','buyer','tenant','owner','other')),
 email text, phone text, notes text,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,tenant_id)
);
create index contacts_tenant_idx on public.contacts(tenant_id,created_at desc);
create index contacts_created_by_idx on public.contacts(created_by);

create table public.leads (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 contact_id uuid not null,
 property_id uuid,
 stage text not null default 'new' check(stage in ('new','contacted','visit','proposal','won','lost')),
 source text not null default 'manual' check(source in ('manual','site','whatsapp','other')),
 notes text,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,tenant_id),
 foreign key(contact_id,tenant_id) references public.contacts(id,tenant_id),
 foreign key(property_id,tenant_id) references public.properties(id,tenant_id)
);
create index leads_tenant_stage_idx on public.leads(tenant_id,stage,created_at desc);
create index leads_contact_fk_idx on public.leads(contact_id,tenant_id);
create index leads_property_fk_idx on public.leads(property_id,tenant_id);
create index leads_created_by_idx on public.leads(created_by);

create table public.visits (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 contact_id uuid not null,
 property_id uuid not null,
 scheduled_at timestamptz not null,
 status text not null default 'scheduled' check(status in ('scheduled','completed','cancelled')),
 notes text,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(contact_id,tenant_id) references public.contacts(id,tenant_id),
 foreign key(property_id,tenant_id) references public.properties(id,tenant_id)
);
create index visits_tenant_date_idx on public.visits(tenant_id,scheduled_at);
create index visits_contact_fk_idx on public.visits(contact_id,tenant_id);
create index visits_property_fk_idx on public.visits(property_id,tenant_id);
create index visits_created_by_idx on public.visits(created_by);

-- O tenant_id nunca pode ser transferido entre imobiliarias.
-- O autor e a data de criacao tambem ficam imutaveis.
create or replace function app_private.lock_operational_identity()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.tenant_id is distinct from old.tenant_id
   or new.id is distinct from old.id
   or new.created_by is distinct from old.created_by
   or new.created_at is distinct from old.created_at then
   raise exception 'Nao e permitido alterar a identidade de um registro' using errcode='42501';
 end if;
 new.updated_at = now();
 return new;
end;
$$;
create trigger properties_lock_identity before update on public.properties
for each row execute function app_private.lock_operational_identity();
create trigger contacts_lock_identity before update on public.contacts
for each row execute function app_private.lock_operational_identity();
create trigger leads_lock_identity before update on public.leads
for each row execute function app_private.lock_operational_identity();
create trigger visits_lock_identity before update on public.visits
for each row execute function app_private.lock_operational_identity();

alter table public.properties enable row level security;
alter table public.contacts enable row level security;
alter table public.leads enable row level security;
alter table public.visits enable row level security;
revoke all on public.properties,public.contacts,public.leads,public.visits from anon,authenticated;
grant select,insert,update on public.properties,public.contacts,public.leads,public.visits to authenticated;

create policy property_view on public.properties for select to authenticated
 using((select app_private.tenant_can_use(tenant_id)));
create policy property_insert on public.properties for insert to authenticated
 with check ((select app_private.tenant_can_manage(tenant_id)) and created_by=auth.uid());
create policy property_update on public.properties for update to authenticated
 using((select app_private.tenant_can_manage(tenant_id)))
 with check((select app_private.tenant_can_manage(tenant_id)));

create policy contact_view on public.contacts for select to authenticated
 using((select app_private.tenant_can_use(tenant_id)));
create policy contact_insert on public.contacts for insert to authenticated
 with check ((select app_private.tenant_can_use(tenant_id)) and created_by=auth.uid());
create policy contact_update on public.contacts for update to authenticated
 using((select app_private.tenant_can_use(tenant_id)))
 with check((select app_private.tenant_can_use(tenant_id)));

create policy lead_view on public.leads for select to authenticated
 using((select app_private.tenant_can_use(tenant_id)));
create policy lead_insert on public.leads for insert to authenticated
 with check ((select app_private.tenant_can_use(tenant_id)) and created_by=auth.uid());
create policy lead_update on public.leads for update to authenticated
 using((select app_private.tenant_can_use(tenant_id)))
 with check((select app_private.tenant_can_use(tenant_id)));

create policy visit_view on public.visits for select to authenticated
 using((select app_private.tenant_can_use(tenant_id)));
create policy visit_insert on public.visits for insert to authenticated
 with check ((select app_private.tenant_can_use(tenant_id)) and created_by=auth.uid());
create policy visit_update on public.visits for update to authenticated
 using((select app_private.tenant_can_use(tenant_id)))
 with check((select app_private.tenant_can_use(tenant_id)));

-- Impede que duas linhas de proprietario sejam associadas a um mesmo tenant.
create unique index tenant_one_owner_idx on public.tenant_members(tenant_id) where role='owner';
