-- VILLE Imobiliário 010 | vitrines isoladas, personalização e imagens.
-- Dados privados (contatos, contratos, pagamentos, membros) nunca são publicados.

create table public.tenant_websites (
 tenant_id uuid primary key references public.tenants(id) on delete cascade,
 site_name text not null check(char_length(trim(site_name)) between 2 and 100),
 tagline text not null default 'Encontre o imóvel ideal para você' check(char_length(tagline)<=140),
 about_text text not null default '' check(char_length(about_text)<=1500),
 primary_color text not null default '#0E359D' check(primary_color ~ '^#[0-9A-Fa-f]{6}$'),
 accent_color text not null default '#FF606A' check(accent_color ~ '^#[0-9A-Fa-f]{6}$'),
 whatsapp text check(whatsapp is null or whatsapp ~ '^[0-9]{10,15}$'),
 public_phone text check(char_length(coalesce(public_phone,''))<=30),
 instagram_url text check(instagram_url is null or instagram_url ~ '^https://(www\.)?instagram\.com/[a-zA-Z0-9._/?=&-]{1,160}$'),
 address_text text check(char_length(coalesce(address_text,''))<=260),
 logo_path text check(logo_path is null or logo_path like tenant_id::text || '/branding/%'),
 banner_path text check(banner_path is null or banner_path like tenant_id::text || '/branding/%'),
 is_published boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id)
);
create index tenant_websites_published_idx on public.tenant_websites(is_published) where is_published;
alter table public.tenant_websites enable row level security;
revoke all on public.tenant_websites from anon,authenticated;
grant select,insert,update on public.tenant_websites to authenticated;
create policy website_select on public.tenant_websites for select to authenticated
 using ((select app_private.tenant_can_manage(tenant_id)));
create policy website_insert on public.tenant_websites for insert to authenticated
 with check ((select app_private.tenant_can_manage(tenant_id)) and updated_by=auth.uid());
create policy website_update on public.tenant_websites for update to authenticated
 using((select app_private.tenant_can_manage(tenant_id)))
 with check((select app_private.tenant_can_manage(tenant_id)) and updated_by=auth.uid());

create or replace function app_private.lock_website_identity()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.tenant_id is distinct from old.tenant_id then
 raise exception 'Não é permitido transferir um site para outra imobiliária' using errcode='42501';end if;
 new.updated_at=now();
 return new;
end;$$;
create trigger website_identity before update on public.tenant_websites
for each row execute function app_private.lock_website_identity();

create table public.property_images (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 property_id uuid not null,
 storage_path text not null unique,
 position smallint not null default 0 check(position between 0 and 30),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 foreign key(property_id,tenant_id) references public.properties(id,tenant_id),
 check(storage_path like tenant_id::text||'/properties/'||property_id::text||'/%')
);
create index property_images_property_idx on public.property_images(tenant_id,property_id,position,created_at);
create index property_images_author_idx on public.property_images(created_by);
alter table public.property_images enable row level security;
revoke all on public.property_images from anon,authenticated;
grant select,insert,delete on public.property_images to authenticated;
create policy property_images_select on public.property_images for select to authenticated
 using ((select app_private.tenant_can_use(tenant_id)));
create policy property_images_insert on public.property_images for insert to authenticated
 with check ((select app_private.tenant_can_manage(tenant_id)) and created_by=auth.uid());
create policy property_images_delete on public.property_images for delete to authenticated
 using ((select app_private.tenant_can_manage(tenant_id)));

create or replace function app_private.limit_property_images()
returns trigger language plpgsql set search_path=''
as $$
begin
 perform 1 from public.properties where id=new.property_id and tenant_id=new.tenant_id for update;
 if (select count(*) from public.property_images where tenant_id=new.tenant_id and property_id=new.property_id)>=12
 then raise exception 'Limite de 12 imagens por imóvel' using errcode='22023';end if;
 return new;
end;$$;
create trigger property_images_limit before insert on public.property_images
for each row execute function app_private.limit_property_images();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ville-public-media','ville-public-media',true,7340032,ARRAY['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

create policy ville_media_upload on storage.objects for insert to authenticated
 with check (
 bucket_id='ville-public-media'
 and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 and (storage.foldername(name))[2] in ('branding','properties')
 and (select app_private.tenant_can_manage(((storage.foldername(name))[1])::uuid))
);
create policy ville_media_owners_select on storage.objects for select to authenticated
 using(
 bucket_id='ville-public-media'
 and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 and (select app_private.tenant_can_manage(((storage.foldername(name))[1])::uuid))
);
create policy ville_media_owners_delete on storage.objects for delete to authenticated
 using(
 bucket_id='ville-public-media'
 and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 and (select app_private.tenant_can_manage(((storage.foldername(name))[1])::uuid))
);

-- Situação ativa/contrato em dia é validada mesmo em consultas públicas.
create or replace function app_private.website_tenant_active(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
select exists(
 select 1 from public.tenants t
 join public.subscriptions s on s.tenant_id=t.id
 where t.id=p_tenant_id and t.state='enabled'
 and (
  (s.status='trial' and now()<=s.trial_ends_at+make_interval(days=>s.grace_days))
  or (s.status in ('active','past_due') and
   ((s.paid_until is not null and s.paid_until>=current_date)
   or (s.next_due_on is not null and current_date<=s.next_due_on+s.grace_days)))
 )
);
$$;
revoke all on function app_private.website_tenant_active(uuid) from public,anon;
grant execute on function app_private.website_tenant_active(uuid) to authenticated;

-- Resultado JSON restrito: nenhum SELECT público em tabelas internas.
create or replace function app_private.website_payload(p_slug text,p_preview boolean)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_t public.tenants%rowtype;v_site public.tenant_websites%rowtype;
v_items jsonb;v_site_json jsonb;
begin
 if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then return null;end if;
 select * into v_t from public.tenants where slug=p_slug;
 if v_t.id is null then return null;end if;
 if p_preview then
  if not app_private.tenant_can_manage(v_t.id) then return null;end if;
 else
  if not app_private.website_tenant_active(v_t.id) then return null;end if;
 end if;
 select * into v_site from public.tenant_websites where tenant_id=v_t.id;
 if not p_preview and (v_site.tenant_id is null or v_site.is_published is not true) then return null;end if;
 v_site_json=jsonb_build_object(
   'slug',v_t.slug,'name',coalesce(v_site.site_name,v_t.name),
   'tagline',coalesce(v_site.tagline,'Encontre o imóvel ideal para você'),
   'about',coalesce(v_site.about_text,''),
   'primary_color',coalesce(v_site.primary_color,'#0E359D'),
   'accent_color',coalesce(v_site.accent_color,'#FF606A'),
   'whatsapp',v_site.whatsapp,'phone',v_site.public_phone,
   'instagram',v_site.instagram_url,'address',v_site.address_text,
   'logo_path',v_site.logo_path,'banner_path',v_site.banner_path,
   'published',coalesce(v_site.is_published,false)
 );
 select coalesce(jsonb_agg(x.item order by x.created_at desc),'[]'::jsonb) into v_items
 from (
  select p.created_at,
    jsonb_build_object(
    'id',p.id,'title',p.title,'type',p.property_type,'purpose',p.purpose,'city',p.city,
    'neighborhood',p.neighborhood,'description',p.description,
    'price_sale',p.sale_price_cents,'price_rent',p.rental_price_cents,
    'bedrooms',p.bedrooms,'bathrooms',p.bathrooms,'parking',p.parking_spaces,
    'area',p.area_m2,'photos',(
      select coalesce(jsonb_agg(pi.storage_path order by pi.position,pi.created_at),'[]'::jsonb)
      from public.property_images pi where pi.tenant_id=p.tenant_id and pi.property_id=p.id
    )) as item
  from public.properties p
  where p.tenant_id=v_t.id and p.published=true and p.status='available'
  order by p.created_at desc limit 150
 ) x;
 return jsonb_build_object('website',v_site_json,'properties',v_items);
end;$$;
revoke all on function app_private.website_payload(text,boolean) from public,anon;
grant execute on function app_private.website_payload(text,boolean) to authenticated;

create or replace function public.public_website(p_slug text)
returns jsonb language sql stable security invoker set search_path=''
as $$ select app_private.website_payload(p_slug,false) $$;
revoke all on function public.public_website(text) from public;
grant execute on function public.public_website(text) to anon,authenticated;

create or replace function public.preview_website(p_slug text)
returns jsonb language sql stable security invoker set search_path=''
as $$ select app_private.website_payload(p_slug,true) $$;
revoke all on function public.preview_website(text) from public,anon;
grant execute on function public.preview_website(text) to authenticated;
