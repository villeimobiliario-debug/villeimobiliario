-- 006: modulo imobiliario financeiro, alugueis, repasses, historico e documentos
-- Todas as referencias vinculadas a objetos de um mesmo tenant.

create table public.rental_contracts (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 property_id uuid not null,
 tenant_contact_id uuid not null,
 owner_contact_id uuid not null,
 start_on date not null,
 end_on date not null,
 due_day smallint not null default 10 check(due_day between 1 and 28),
 monthly_rent_cents bigint not null check(monthly_rent_cents>0),
 administration_fee_percent numeric(5,2) not null default 10 check(administration_fee_percent between 0 and 100),
 status text not null default 'draft' check(status in ('draft','active','ended','cancelled')),
 notes text,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,tenant_id),
 check(end_on>=start_on),
 check(tenant_contact_id<>owner_contact_id),
 foreign key(property_id,tenant_id) references public.properties(id,tenant_id),
 foreign key(tenant_contact_id,tenant_id) references public.contacts(id,tenant_id),
 foreign key(owner_contact_id,tenant_id) references public.contacts(id,tenant_id)
);
create index rental_contracts_tenant_idx on public.rental_contracts(tenant_id,status,end_on);
create index rental_contracts_property_fk_idx on public.rental_contracts(property_id,tenant_id);
create index rental_contracts_tenant_contact_fk_idx on public.rental_contracts(tenant_contact_id,tenant_id);
create index rental_contracts_owner_contact_fk_idx on public.rental_contracts(owner_contact_id,tenant_id);
create index rental_contracts_created_by_idx on public.rental_contracts(created_by);

create table public.rent_charges (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 contract_id uuid not null,
 due_on date not null,
 amount_cents bigint not null check(amount_cents>0),
 status text not null default 'open' check(status in ('open','paid','cancelled')),
 paid_on date,
 notes text,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,tenant_id),
 unique(tenant_id,contract_id,due_on),
 foreign key(contract_id,tenant_id) references public.rental_contracts(id,tenant_id),
 check ((status='paid' and paid_on is not null) or (status<>'paid' and paid_on is null))
);
create index rent_charges_tenant_idx on public.rent_charges(tenant_id,status,due_on);
create index rent_charges_contract_fk_idx on public.rent_charges(contract_id,tenant_id);
create index rent_charges_created_by_idx on public.rent_charges(created_by);

create table public.owner_payouts (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 charge_id uuid not null,
 owner_contact_id uuid not null,
 gross_cents bigint not null check(gross_cents>0),
 administration_fee_cents bigint not null check(administration_fee_cents>=0),
 net_cents bigint not null check(net_cents>=0),
 status text not null default 'pending' check(status in ('pending','paid')),
 paid_on date,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,charge_id),
 foreign key(charge_id,tenant_id) references public.rent_charges(id,tenant_id),
 foreign key(owner_contact_id,tenant_id) references public.contacts(id,tenant_id),
 check (gross_cents=administration_fee_cents+net_cents),
 check((status='paid' and paid_on is not null) or (status='pending' and paid_on is null))
);
create index owner_payouts_tenant_idx on public.owner_payouts(tenant_id,status);
create index owner_payouts_charge_fk_idx on public.owner_payouts(charge_id,tenant_id);
create index owner_payouts_contact_fk_idx on public.owner_payouts(owner_contact_id,tenant_id);

create table public.finance_entries (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 direction text not null check(direction in ('income','expense')),
 category text not null check(char_length(trim(category)) between 2 and 80),
 description text not null check(char_length(trim(description)) between 2 and 240),
 amount_cents bigint not null check(amount_cents>0),
 occurred_on date not null default current_date,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,tenant_id)
);
create index finance_entries_tenant_date_idx on public.finance_entries(tenant_id,occurred_on desc);
create index finance_entries_created_by_idx on public.finance_entries(created_by);

create table public.property_events (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 property_id uuid not null,
 actor_id uuid references auth.users(id),
 action text not null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 foreign key(property_id,tenant_id) references public.properties(id,tenant_id)
);
create index property_events_tenant_idx on public.property_events(tenant_id,created_at desc);
create index property_events_property_fk_idx on public.property_events(property_id,tenant_id);

create table public.documents (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 title text not null check(char_length(trim(title)) between 2 and 160),
 property_id uuid,
 contact_id uuid,
 storage_path text not null unique,
 mime_type text not null,
 bytes bigint not null check(bytes between 1 and 10485760),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 unique(id,tenant_id),
 foreign key(property_id,tenant_id) references public.properties(id,tenant_id),
 foreign key(contact_id,tenant_id) references public.contacts(id,tenant_id),
 check(storage_path like tenant_id::text || '/%')
);
create index documents_tenant_idx on public.documents(tenant_id,created_at desc);
create index documents_property_fk_idx on public.documents(property_id,tenant_id);
create index documents_contact_fk_idx on public.documents(contact_id,tenant_id);
create index documents_created_by_idx on public.documents(created_by);

create trigger rental_contracts_lock before update on public.rental_contracts
 for each row execute function app_private.lock_operational_identity();
create trigger rent_charges_lock before update on public.rent_charges
 for each row execute function app_private.lock_operational_identity();
create trigger finance_entries_lock before update on public.finance_entries
 for each row execute function app_private.lock_operational_identity();

create or replace function app_private.lock_payout_identity()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.id<>old.id or new.tenant_id<>old.tenant_id or new.charge_id<>old.charge_id
  or new.owner_contact_id<>old.owner_contact_id or new.gross_cents<>old.gross_cents
  or new.administration_fee_cents<>old.administration_fee_cents or new.net_cents<>old.net_cents
  or new.created_at<>old.created_at then
    raise exception 'Os valores de repasse nao podem ser alterados' using errcode='42501';
 end if;
 new.updated_at=now();return new;
end; $$;
create trigger payouts_lock before update on public.owner_payouts
for each row execute function app_private.lock_payout_identity();

-- Historico automatico, somente inserido pelo servidor.
create or replace function app_private.track_property()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_details jsonb;
begin
 if tg_op='INSERT' then
   insert into public.property_events(tenant_id,property_id,actor_id,action,details)
    values(new.tenant_id,new.id,auth.uid(),'created',jsonb_build_object('status',new.status));
 elsif tg_op='UPDATE' then
   v_details=jsonb_strip_nulls(jsonb_build_object(
    'before_status',case when old.status is distinct from new.status then old.status end,
    'after_status',case when old.status is distinct from new.status then new.status end,
    'before_sale_cents',case when old.sale_price_cents is distinct from new.sale_price_cents then old.sale_price_cents end,
    'after_sale_cents',case when old.sale_price_cents is distinct from new.sale_price_cents then new.sale_price_cents end,
    'before_rent_cents',case when old.rental_price_cents is distinct from new.rental_price_cents then old.rental_price_cents end,
    'after_rent_cents',case when old.rental_price_cents is distinct from new.rental_price_cents then new.rental_price_cents end
   ));
   if v_details<>'{}'::jsonb then
    insert into public.property_events(tenant_id,property_id,actor_id,action,details)
     values(new.tenant_id,new.id,auth.uid(),'updated',v_details);
   end if;
 end if;
 return new;
end;$$;
create trigger properties_track after insert or update on public.properties
for each row execute function app_private.track_property();

-- Ao marcar aluguel como recebido, gera repasse calculado e auditavel.
create or replace function app_private.create_owner_payout()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_owner uuid;v_rate numeric(5,2);v_fee bigint;
begin
 if new.status='paid' and (tg_op='INSERT' or old.status is distinct from 'paid') then
  select owner_contact_id,administration_fee_percent into v_owner,v_rate
   from public.rental_contracts where id=new.contract_id and tenant_id=new.tenant_id;
  v_fee=round((new.amount_cents::numeric*v_rate)/100)::bigint;
  insert into public.owner_payouts(tenant_id,charge_id,owner_contact_id,gross_cents,
      administration_fee_cents,net_cents)
   values(new.tenant_id,new.id,v_owner,new.amount_cents,v_fee,new.amount_cents-v_fee)
   on conflict(tenant_id,charge_id) do nothing;
 end if;
 return new;
end;$$;
create trigger rent_charge_paid after insert or update of status on public.rent_charges
for each row execute function app_private.create_owner_payout();

alter table public.rental_contracts enable row level security;
alter table public.rent_charges enable row level security;
alter table public.owner_payouts enable row level security;
alter table public.finance_entries enable row level security;
alter table public.property_events enable row level security;
alter table public.documents enable row level security;
revoke all on public.rental_contracts,public.rent_charges,public.owner_payouts,
 public.finance_entries,public.property_events,public.documents from anon,authenticated;
grant select,insert,update on public.rental_contracts,public.rent_charges,public.finance_entries to authenticated;
grant select,update(status,paid_on) on public.owner_payouts to authenticated;
grant select on public.property_events to authenticated;
grant select,insert on public.documents to authenticated;

create policy rental_read on public.rental_contracts for select to authenticated
 using((select app_private.tenant_can_use(tenant_id)));
create policy rental_insert on public.rental_contracts for insert to authenticated
 with check((select app_private.tenant_can_manage(tenant_id)) and created_by=auth.uid());
create policy rental_update on public.rental_contracts for update to authenticated
 using((select app_private.tenant_can_manage(tenant_id)))
 with check((select app_private.tenant_can_manage(tenant_id)));

create policy charges_read on public.rent_charges for select to authenticated
 using((select app_private.tenant_can_use(tenant_id)));
create policy charges_insert on public.rent_charges for insert to authenticated
 with check((select app_private.tenant_can_manage(tenant_id)) and created_by=auth.uid());
create policy charges_update on public.rent_charges for update to authenticated
 using((select app_private.tenant_can_manage(tenant_id)))
 with check((select app_private.tenant_can_manage(tenant_id)));

create policy payouts_read on public.owner_payouts for select to authenticated
 using((select app_private.tenant_can_manage(tenant_id)));
create policy payouts_update on public.owner_payouts for update to authenticated
 using((select app_private.tenant_can_manage(tenant_id)))
 with check((select app_private.tenant_can_manage(tenant_id)));

create policy finances_read on public.finance_entries for select to authenticated
 using((select app_private.tenant_can_manage(tenant_id)));
create policy finances_insert on public.finance_entries for insert to authenticated
 with check((select app_private.tenant_can_manage(tenant_id)) and created_by=auth.uid());
create policy finances_update on public.finance_entries for update to authenticated
 using((select app_private.tenant_can_manage(tenant_id)))
 with check((select app_private.tenant_can_manage(tenant_id)));

create policy history_read on public.property_events for select to authenticated
 using((select app_private.tenant_can_use(tenant_id)));

create policy documents_read on public.documents for select to authenticated
 using((select app_private.tenant_can_manage(tenant_id)));
create policy documents_insert on public.documents for insert to authenticated
 with check((select app_private.tenant_can_manage(tenant_id)) and created_by=auth.uid());

-- Arquivos privados. Download sempre autenticado, limitado a sua imobiliaria.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ville-agency-docs','ville-agency-docs',false,10485760,
 array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy ville_document_object_read on storage.objects for select to authenticated
 using(bucket_id='ville-agency-docs' and
  (select app_private.tenant_can_manage(
   case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (storage.foldername(name))[1]::uuid else null end
  )));
create policy ville_document_object_insert on storage.objects for insert to authenticated
 with check(bucket_id='ville-agency-docs' and
  (select app_private.tenant_can_manage(
   case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (storage.foldername(name))[1]::uuid else null end
  )));
