-- 011: Fotos privadas com URLs assinadas e captação pública validada.
-- Arquivos anteriores serão privados. Não há imagens cadastradas nesta fase piloto.
update storage.buckets set public=false where id='ville-public-media';

create or replace function app_private.website_media_allowed(p_slug text,p_path text,p_preview boolean)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_id uuid;v_site public.tenant_websites%rowtype;
begin
 if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$'
 or p_path is null or char_length(p_path)>260 then return false;end if;
 select id into v_id from public.tenants where slug=p_slug;
 if v_id is null or p_path not like v_id::text||'/%' then return false;end if;
 if p_preview then
  if not app_private.tenant_can_manage(v_id) then return false;end if;
 else
  if not app_private.website_tenant_active(v_id) then return false;end if;
 end if;
 select * into v_site from public.tenant_websites where tenant_id=v_id;
 if not p_preview and coalesce(v_site.is_published,false)=false then return false;end if;
 if p_path=v_site.logo_path or p_path=v_site.banner_path then return true;end if;
 return exists(
 select 1 from public.property_images i join public.properties p
 on p.id=i.property_id and p.tenant_id=i.tenant_id
 where i.tenant_id=v_id and i.storage_path=p_path
 and (p_preview or (p.published=true and p.status='available'))
 );
end;$$;

create or replace function public.website_media_public(p_slug text,p_path text)
returns boolean language sql stable security definer set search_path=''
as $$select app_private.website_media_allowed(p_slug,p_path,false)$$;
revoke all on function public.website_media_public(text,text) from public;
grant execute on function public.website_media_public(text,text) to anon,authenticated;

create or replace function public.website_media_preview(p_slug text,p_path text)
returns boolean language sql stable security definer set search_path=''
as $$select app_private.website_media_allowed(p_slug,p_path,true)$$;
revoke all on function public.website_media_preview(text,text) from public,anon;
grant execute on function public.website_media_preview(text,text) to authenticated;

create table public.website_inquiries (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 property_id uuid not null,
 contact_id uuid not null,
 lead_id uuid not null,
 phone text not null,
 created_at timestamptz not null default now(),
 foreign key(property_id,tenant_id) references public.properties(id,tenant_id),
 foreign key(contact_id,tenant_id) references public.contacts(id,tenant_id),
 foreign key(lead_id,tenant_id) references public.leads(id,tenant_id)
);
create index website_inquiries_phone_rate_idx on public.website_inquiries(tenant_id,phone,created_at desc);
create index website_inquiries_tenant_rate_idx on public.website_inquiries(tenant_id,created_at desc);
create index website_inquiries_property_fk_idx on public.website_inquiries(property_id,tenant_id);
create index website_inquiries_contact_fk_idx on public.website_inquiries(contact_id,tenant_id);
create index website_inquiries_lead_fk_idx on public.website_inquiries(lead_id,tenant_id);
alter table public.website_inquiries enable row level security;
revoke all on public.website_inquiries from public,anon,authenticated;
grant select on public.website_inquiries to authenticated;
create policy inquiry_team_select on public.website_inquiries for select to authenticated
 using((select app_private.tenant_can_manage(tenant_id)));

create or replace function app_private.capture_website_lead(p_slug text,p_property_id uuid,p_name text,p_phone text,p_agree boolean,p_honeypot text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_tenant uuid;v_owner uuid;v_phone text;v_full_name text;v_contact uuid;v_lead uuid;
begin
 if p_honeypot is not null and trim(p_honeypot)<>'' then return false;end if;
 if p_agree is not true then raise exception 'É necessário autorizar o contato' using errcode='22023';end if;
 if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then return false;end if;
 v_full_name=trim(coalesce(p_name,''));
 v_phone=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
 if char_length(v_full_name) not between 2 and 100 or char_length(v_phone) not between 10 and 13
 then raise exception 'Informe nome e telefone válidos' using errcode='22023';end if;
 select t.id into v_tenant from public.tenants t
 join public.tenant_websites w on w.tenant_id=t.id and w.is_published=true
 where t.slug=p_slug;
 if v_tenant is null or not app_private.website_tenant_active(v_tenant) then return false;end if;
 if not exists(select 1 from public.properties
 where id=p_property_id and tenant_id=v_tenant and published=true and status='available') then return false;end if;
 select user_id into v_owner from public.tenant_members where tenant_id=v_tenant and role='owner';
 if v_owner is null then return false;end if;
 -- Bloqueio de concorrência para o mesmo telefone durante a contagem e gravação.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_tenant::text||':'||v_phone));
 if (select count(*) from public.website_inquiries
     where tenant_id=v_tenant and phone=v_phone and created_at>now()-interval '1 hour')>=3
    or (select count(*) from public.website_inquiries
     where tenant_id=v_tenant and created_at>now()-interval '1 hour')>=60
 then raise exception 'Limite temporário de solicitações atingido' using errcode='22023';end if;
 insert into public.contacts(tenant_id,full_name,kind,phone,notes,created_by)
 values(v_tenant,v_full_name,'lead',v_phone,'Contato originado na vitrine pública',v_owner)
 returning id into v_contact;
 insert into public.leads(tenant_id,contact_id,property_id,stage,source,notes,created_by)
 values(v_tenant,v_contact,p_property_id,'new','site','Interessado pela vitrine pública',v_owner)
 returning id into v_lead;
 insert into public.website_inquiries(tenant_id,property_id,contact_id,lead_id,phone)
 values(v_tenant,p_property_id,v_contact,v_lead,v_phone);
 return true;
end;$$;
revoke all on function app_private.capture_website_lead(text,uuid,text,text,boolean,text) from public,anon,authenticated;
create or replace function public.website_request_contact(p_slug text,p_property_id uuid,p_name text,p_phone text,p_agree boolean,p_honeypot text default '')
returns boolean language sql volatile security definer set search_path=''
as $$ select app_private.capture_website_lead(p_slug,p_property_id,p_name,p_phone,p_agree,p_honeypot) $$;
revoke all on function public.website_request_contact(text,uuid,text,text,boolean,text) from public;
grant execute on function public.website_request_contact(text,uuid,text,text,boolean,text) to anon,authenticated;
