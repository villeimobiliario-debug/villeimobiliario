-- 018: métricas de visitas da vitrine, isoladas por imobiliária e sem guardar IP.
-- Identificador anônimo e temporário de sessão convertido em hash no banco.
create table if not exists public.website_analytics_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid,
  event_type text not null check(event_type in ('site_visit','property_view','whatsapp_click')),
  visitor_hash text not null check(visitor_hash ~ '^[0-9a-f]{32}$'),
  bucket_start timestamptz not null,
  occurred_at timestamptz not null default now(),
  foreign key(property_id,tenant_id) references public.properties(id,tenant_id) on delete cascade,
  check((event_type='property_view' and property_id is not null) or event_type in ('site_visit','whatsapp_click')),
  check(event_type <> 'site_visit' or property_id is null)
);
create unique index if not exists website_analytics_dedupe_idx
 on public.website_analytics_events
 (tenant_id,visitor_hash,event_type,coalesce(property_id,'00000000-0000-0000-0000-000000000000'::uuid),bucket_start);
create index if not exists website_analytics_period_idx
 on public.website_analytics_events(tenant_id,occurred_at desc,event_type);
create index if not exists website_analytics_property_idx
 on public.website_analytics_events(tenant_id,property_id,occurred_at desc);
alter table public.website_analytics_events enable row level security;
revoke all on public.website_analytics_events from public,anon,authenticated;
-- Somente RPCs validam/registram e mostram contadores agregados.

create or replace function public.website_track_event(
 p_slug text,p_event text,p_visitor uuid,p_property_id uuid default null
) returns boolean
language plpgsql volatile security definer set search_path=''
as $$
declare v_tenant uuid;v_bucket timestamptz;v_period interval;v_hash text;
begin
 if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' or
 p_event not in ('site_visit','property_view','whatsapp_click') or
 p_visitor is null or p_visitor='00000000-0000-0000-0000-000000000000'::uuid then return false;end if;
 if (p_event='site_visit' and p_property_id is not null)
  or (p_event='property_view' and p_property_id is null) then return false;end if;
 select t.id into v_tenant
 from public.tenants t join public.tenant_websites w on w.tenant_id=t.id
 where t.slug=p_slug and w.is_published=true;
 if v_tenant is null or not app_private.website_tenant_active(v_tenant) then return false;end if;
 if p_property_id is not null and not exists(
  select 1 from public.properties
  where id=p_property_id and tenant_id=v_tenant and published=true and status='available'
 ) then return false;end if;
 -- Um evento por janela e sessão, evitando inflar dados por refresh/cliques repetidos.
 v_period=case p_event when 'site_visit' then interval '30 minutes'
  when 'property_view' then interval '15 minutes' else interval '5 minutes' end;
 v_bucket=pg_catalog.date_bin(v_period,now(),'2000-01-01 00:00:00+00'::timestamptz);
 v_hash=md5(v_tenant::text||':'||p_visitor::text);
 -- Impedir duplicações simultâneas e recusar picos suspeitos sem manter IP.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_tenant::text||':'||v_hash));
 if (select count(*) from public.website_analytics_events
  where tenant_id=v_tenant and occurred_at>now()-interval '1 minute')>=300 then return false;end if;
 insert into public.website_analytics_events(tenant_id,property_id,event_type,visitor_hash,bucket_start)
 values(v_tenant,p_property_id,p_event,v_hash,v_bucket)
 on conflict do nothing;
 return true;
end;$$;
revoke all on function public.website_track_event(text,text,uuid,uuid) from public;
grant execute on function public.website_track_event(text,text,uuid,uuid) to anon,authenticated;

create or replace function public.website_analytics_summary(
 p_tenant_id uuid,p_period text default '30d'
) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare v_since timestamptz;v_summary jsonb;v_houses jsonb;
begin
 if p_tenant_id is null or not app_private.tenant_can_manage(p_tenant_id) then
  raise exception 'Sem acesso aos indicadores desta imobiliária' using errcode='42501';
 end if;
 v_since=case p_period
  when 'today' then date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
  when '7d' then now()-interval '7 days'
  when '30d' then now()-interval '30 days'
  else null end;
 if v_since is null then raise exception 'Período inválido' using errcode='22023';end if;
 select jsonb_build_object(
  'unique_visitors',count(distinct e.visitor_hash) filter(where e.event_type='site_visit'),
  'site_visits',count(*) filter(where e.event_type='site_visit'),
  'property_views',count(*) filter(where e.event_type='property_view'),
  'whatsapp_clicks',count(*) filter(where e.event_type='whatsapp_click')
 ) into v_summary
 from public.website_analytics_events e
 where e.tenant_id=p_tenant_id and e.occurred_at>=v_since;
 select coalesce(jsonb_agg(jsonb_build_object('property_id',q.id,'title',q.title,
   'views',q.views,'whatsapp_clicks',q.clicks) order by q.views desc,q.clicks desc,q.title),'[]'::jsonb)
 into v_houses from (
  select p.id,p.title,
   count(e.id) filter(where e.event_type='property_view')::integer as views,
   count(e.id) filter(where e.event_type='whatsapp_click')::integer as clicks
  from public.properties p
  left join public.website_analytics_events e on e.property_id=p.id
    and e.tenant_id=p_tenant_id and e.occurred_at>=v_since
  where p.tenant_id=p_tenant_id
  group by p.id,p.title
  order by views desc,clicks desc,p.title
  limit 200
 ) q;
 return v_summary||jsonb_build_object('period',p_period,'properties',v_houses);
end;$$;
revoke all on function public.website_analytics_summary(uuid,text) from public,anon;
grant execute on function public.website_analytics_summary(uuid,text) to authenticated;

comment on table public.website_analytics_events is
 'Eventos anonimizados da vitrine; sem IP, telefone, email ou identificadores pessoais. Sessões são aproximadas.';
