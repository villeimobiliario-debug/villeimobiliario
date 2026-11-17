-- 016: índice público de imobiliárias e anúncios para sitemap.
create or replace function public.website_sitemap()
returns jsonb language sql stable security definer set search_path=''
as $$
 select coalesce(jsonb_agg(jsonb_build_object('slug',items.slug,'property_id',items.property_id)),'[]'::jsonb)
 from (
  select t.slug,p.id as property_id
  from public.tenants t
  join public.tenant_websites w on w.tenant_id=t.id and w.is_published=true
  left join public.properties p on p.tenant_id=t.id and p.published=true and p.status='available'
  where app_private.website_tenant_active(t.id)
  order by t.slug,p.created_at desc nulls last
  limit 10000
 ) items;
$$;
revoke all on function public.website_sitemap() from public;
grant execute on function public.website_sitemap() to anon,authenticated;
