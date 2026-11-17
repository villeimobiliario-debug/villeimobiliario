-- 015: payload pequeno para cabeçalho do site, sem carregar o catálogo inteiro.
create or replace function public.website_header(p_slug text,p_preview boolean default false)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_t public.tenants%rowtype;v_site public.tenant_websites%rowtype;
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
 if not p_preview and (v_site.tenant_id is null or v_site.is_published=false) then return null;end if;
 return jsonb_build_object(
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
end;$$;
revoke all on function public.website_header(text,boolean) from public;
grant execute on function public.website_header(text,boolean) to anon,authenticated;
