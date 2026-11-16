-- 009: vendas registradas e calculo de comissao de forma auditavel
create table public.property_sales (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 property_id uuid not null,
 buyer_contact_id uuid not null,
 agent_user_id uuid,
 sold_on date not null,
 sale_price_cents bigint not null check(sale_price_cents>0),
 commission_percent numeric(5,2) not null default 0 check(commission_percent between 0 and 100),
 commission_cents bigint generated always as
  (round(sale_price_cents::numeric*commission_percent/100)::bigint) stored,
 notes text,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 unique(id,tenant_id),
 unique(tenant_id,property_id),
 foreign key(property_id,tenant_id) references public.properties(id,tenant_id),
 foreign key(buyer_contact_id,tenant_id) references public.contacts(id,tenant_id),
 foreign key(tenant_id,agent_user_id) references public.tenant_members(tenant_id,user_id)
);
create index property_sales_tenant_date_idx on public.property_sales(tenant_id,sold_on desc);
create index property_sales_buyer_fk_idx on public.property_sales(buyer_contact_id,tenant_id);
create index property_sales_agent_fk_idx on public.property_sales(tenant_id,agent_user_id);
create index property_sales_created_by_idx on public.property_sales(created_by);

alter table public.property_sales enable row level security;
revoke all on public.property_sales from anon,authenticated;
grant select,insert on public.property_sales to authenticated;
create policy sales_read on public.property_sales for select to authenticated
 using ((select app_private.tenant_can_manage(tenant_id)) or
  ((select app_private.tenant_can_use(tenant_id)) and agent_user_id=auth.uid()));
create policy sales_insert on public.property_sales for insert to authenticated
 with check((select app_private.tenant_can_manage(tenant_id)) and created_by=auth.uid());

create or replace function app_private.finalize_property_sale()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 update public.properties set status='sold' where id=new.property_id and tenant_id=new.tenant_id;
 insert into public.audit_events(actor_id,tenant_id,action,entity_type,entity_id,details)
 values(auth.uid(),new.tenant_id,'property.sale_recorded','property_sale',new.id::text,
 jsonb_build_object('property_id',new.property_id,'sale_price_cents',new.sale_price_cents,
 'commission_cents',new.commission_cents,'agent_id',new.agent_user_id));
 return new;
end;$$;
create trigger property_sale_finalized after insert on public.property_sales
 for each row execute function app_private.finalize_property_sale();
