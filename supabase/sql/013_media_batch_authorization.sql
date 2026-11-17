-- 013: validação em lote de mídias, sem expor o bucket.
create or replace function public.website_media_authorized(p_slug text,p_paths text[],p_preview boolean default false)
returns text[] language plpgsql stable security definer set search_path=''
as $$
declare v_auth text[];
begin
 if p_paths is null or cardinality(p_paths)>24 or
 p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then return array[]::text[];end if;
 select coalesce(array_agg(p.path),array[]::text[]) into v_auth from
 (select distinct path from unnest(p_paths) path where
  char_length(path)<=260 and path !~ '\.\.' and
  app_private.website_media_allowed(p_slug,path,p_preview)) p;
 return v_auth;
end;$$;
revoke all on function public.website_media_authorized(text,text[],boolean) from public;
grant execute on function public.website_media_authorized(text,text[],boolean) to anon,authenticated;
