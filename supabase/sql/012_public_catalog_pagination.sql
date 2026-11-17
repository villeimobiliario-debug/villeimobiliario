-- 012: Catálogo paginado, busca e filtro dentro do banco com isolamento por imobiliária.
create index if not exists properties_public_catalog_idx on public.properties
 (tenant_id,created_at desc,id) where published=true and status='available';

create or replace function public.website_search_properties(
 p_slug text,
 p_query text default '',
 p_purpose text default '',
 p_type text default '',
 p_offset integer default 0,
 p_limit integer default 12,
 p_preview boolean default false,
 p_property_id uuid default null
) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare v_tenant uuid;v_query text;v_limit integer;v_offset integer;v_total integer;v_properties jsonb;
begin
 if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then return null;end if;
 if char_length(coalesce(p_query,''))>80 or p_offset<0 or p_offset>50000 or p_limit<1 or p_limit>24 then
  return null;end if;
 if coalesce(p_purpose,'') not in ('','sale','rent') or coalesce(p_type,'') not in
  ('','house','apartment','land','commercial','rural','other') then return null;end if;
 select t.id into v_tenant from public.tenants t where t.slug=p_slug;
 if v_tenant is null then return null;end if;
 if p_preview then
  if not app_private.tenant_can_manage(v_tenant) then return null;end if;
 else
  if not app_private.website_tenant_active(v_tenant) then return null;end if;
  if not exists(select 1 from public.tenant_websites w
   where w.tenant_id=v_tenant and w.is_published=true) then return null;end if;
 end if;
 v_query=trim(coalesce(p_query,''));v_limit=p_limit;v_offset=p_offset;
 select count(*) into v_total from public.properties p
 where p.tenant_id=v_tenant and p.published=true and p.status='available'
 and (p_property_id is null or p.id=p_property_id)
 and (p_purpose='' or p_purpose is null or p.purpose=p_purpose or p.purpose='both')
 and (p_type='' or p_type is null or p.property_type=p_type)
 and (v_query='' or coalesce(p.title,'') ilike '%'||v_query||'%'
 or coalesce(p.city,'') ilike '%'||v_query||'%'
 or coalesce(p.neighborhood,'') ilike '%'||v_query||'%');
 select coalesce(jsonb_agg(item order by created_at desc,id desc),'[]'::jsonb) into v_properties
 from(
  select p.id,p.created_at,jsonb_build_object(
   'id',p.id,'title',p.title,'type',p.property_type,'purpose',p.purpose,
   'city',p.city,'neighborhood',p.neighborhood,'description',p.description,
   'price_sale',p.sale_price_cents,'price_rent',p.rental_price_cents,
   'bedrooms',p.bedrooms,'bathrooms',p.bathrooms,'parking',p.parking_spaces,
   'area',p.area_m2,'photos',(
    select coalesce(jsonb_agg(i.storage_path order by i.position,i.created_at),'[]'::jsonb)
    from public.property_images i where i.tenant_id=p.tenant_id and i.property_id=p.id
   )
  ) as item
  from public.properties p
  where p.tenant_id=v_tenant and p.published=true and p.status='available'
  and (p_property_id is null or p.id=p_property_id)
  and (p_purpose='' or p_purpose is null or p.purpose=p_purpose or p.purpose='both')
  and (p_type='' or p_type is null or p.property_type=p_type)
  and (v_query='' or coalesce(p.title,'') ilike '%'||v_query||'%'
   or coalesce(p.city,'') ilike '%'||v_query||'%'
   or coalesce(p.neighborhood,'') ilike '%'||v_query||'%')
  order by p.created_at desc,p.id desc
  limit v_limit offset v_offset
 ) as listing;
 return jsonb_build_object('properties',v_properties,'total',v_total,'offset',v_offset,'limit',v_limit);
end;$$;
revoke all on function public.website_search_properties(text,text,text,text,integer,integer,boolean,uuid) from public;
grant execute on function public.website_search_properties(text,text,text,text,integer,integer,boolean,uuid) to anon,authenticated;
