-- VILLE Imobiliario | Migration 004: administracao das imobiliarias
-- Cadastro atomico, plano, teste, suspensao, reativacao e auditoria.
alter table public.tenants
 add column contact_name text,
 add column contact_email text,
 add column contact_phone text;

alter table public.tenants
 add constraint tenants_contact_email_format
 check (contact_email is null or (length(contact_email) <= 254 and contact_email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'));
alter table public.tenants
 add constraint tenants_contact_name_length
 check (contact_name is null or char_length(trim(contact_name)) between 2 and 120);
alter table public.tenants
 add constraint tenants_contact_phone_length
 check (contact_phone is null or char_length(contact_phone) <= 30);

-- A equipe de administracao manipula estas entidades apenas pelas RPCs auditadas.
revoke insert, update, delete on public.tenants, public.subscription_plans, public.subscriptions from authenticated;
drop policy if exists tenants_admin_insert on public.tenants;
drop policy if exists tenants_admin_update on public.tenants;
drop policy if exists tenants_admin_delete on public.tenants;
drop policy if exists plans_admin_insert on public.subscription_plans;
drop policy if exists plans_admin_update on public.subscription_plans;
drop policy if exists plans_admin_delete on public.subscription_plans;
drop policy if exists subscriptions_admin_insert on public.subscriptions;
drop policy if exists subscriptions_admin_update on public.subscriptions;
drop policy if exists subscriptions_admin_delete on public.subscriptions;

-- Todas as rotinas privilegiadas ficam num schema NAO exposto pela API.
create or replace function app_private.admin_create_plan_impl(
 p_name text, p_price_cents integer
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
 if not app_private.is_platform_admin() then
  raise exception 'Acesso administrativo necessario' using errcode = '42501';
 end if;
 if p_name is null or char_length(trim(p_name)) not between 2 and 80 then
  raise exception 'Nome do plano deve ter entre 2 e 80 caracteres' using errcode = '22023';
 end if;
 if p_price_cents is null or p_price_cents < 0 or p_price_cents > 100000000 then
  raise exception 'Valor do plano invalido' using errcode = '22023';
 end if;
 insert into public.subscription_plans(name,monthly_price_cents)
 values(trim(p_name), p_price_cents)
 returning id into v_id;
 insert into public.audit_events(actor_id,action,entity_type,entity_id,details)
 values(auth.uid(),'plan.created','subscription_plan',v_id::text,
  jsonb_build_object('name',trim(p_name),'price_cents',p_price_cents));
 return v_id;
end;
$$;

create or replace function public.admin_create_plan(p_name text,p_price_cents integer)
returns uuid language sql security invoker set search_path = ''
as $$
 select app_private.admin_create_plan_impl(p_name,p_price_cents)
$$;

create or replace function app_private.admin_create_tenant_impl(
 p_name text, p_slug text, p_contact_name text,
 p_contact_email text, p_contact_phone text, p_plan_id uuid
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
 v_id uuid;
 v_now timestamptz := now();
 v_trial_days integer;
 v_grace_days integer;
 v_email text := lower(trim(coalesce(p_contact_email,'')));
 v_phone text := nullif(trim(coalesce(p_contact_phone,'')),'');
begin
 if not app_private.is_platform_admin() then
  raise exception 'Acesso administrativo necessario' using errcode = '42501';
 end if;
 if p_name is null or char_length(trim(p_name)) not between 2 and 160 then
  raise exception 'Nome da imobiliaria invalido' using errcode = '22023';
 end if;
 if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug) > 80 then
  raise exception 'Identificador invalido' using errcode = '22023';
 end if;
 if p_contact_name is null or char_length(trim(p_contact_name)) not between 2 and 120 then
  raise exception 'Nome do responsavel invalido' using errcode = '22023';
 end if;
 if char_length(v_email) > 254 or v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
  raise exception 'E-mail do responsavel invalido' using errcode = '22023';
 end if;
 if v_phone is not null and char_length(v_phone)>30 then
  raise exception 'Telefone muito longo' using errcode = '22023';
 end if;
 if not exists(select 1 from public.subscription_plans where id = p_plan_id and active) then
  raise exception 'Plano inexistente ou inativo' using errcode = '22023';
 end if;
 select trial_days,grace_days into v_trial_days,v_grace_days
 from public.platform_settings where singleton is true;
 if v_trial_days is null then
  raise exception 'Configuracoes da plataforma ausentes' using errcode='22023';
 end if;
 insert into public.tenants(name,slug,state,contact_name,contact_email,contact_phone)
 values(trim(p_name),p_slug,'enabled',trim(p_contact_name),v_email,v_phone)
 returning id into v_id;
 insert into public.subscriptions(tenant_id,plan_id,status,trial_started_at,trial_ends_at,next_due_on,grace_days)
 values(v_id,p_plan_id,'trial',v_now,v_now+make_interval(days=>v_trial_days),
        (v_now+make_interval(days=>v_trial_days))::date,v_grace_days);
 insert into public.audit_events(actor_id,tenant_id,action,entity_type,entity_id,details)
 values(auth.uid(),v_id,'tenant.created','tenant',v_id::text,
  jsonb_build_object('plan_id',p_plan_id,'trial_days',v_trial_days,'grace_days',v_grace_days));
 return v_id;
end;
$$;

create or replace function public.admin_create_tenant(
 p_name text,p_slug text,p_contact_name text,
 p_contact_email text,p_contact_phone text,p_plan_id uuid
) returns uuid
language sql security invoker set search_path=''
as $$ select app_private.admin_create_tenant_impl(p_name,p_slug,p_contact_name,p_contact_email,p_contact_phone,p_plan_id) $$;

create or replace function app_private.admin_update_tenant_impl(
 p_tenant_id uuid, p_name text, p_contact_name text, p_contact_email text, p_contact_phone text
) returns void language plpgsql security definer set search_path=''
as $$
declare v_email text := lower(trim(coalesce(p_contact_email,'')));
begin
 if not app_private.is_platform_admin() then
  raise exception 'Acesso administrativo necessario' using errcode='42501';
 end if;
 if p_name is null or char_length(trim(p_name)) not between 2 and 160
    or p_contact_name is null or char_length(trim(p_contact_name)) not between 2 and 120
    or char_length(v_email)>254 or v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
    or char_length(coalesce(p_contact_phone,''))>30 then
  raise exception 'Dados cadastrais invalidos' using errcode='22023';
 end if;
 update public.tenants
 set name=trim(p_name),contact_name=trim(p_contact_name),
 contact_email=v_email,contact_phone=nullif(trim(coalesce(p_contact_phone,'')),''),
 updated_at=now()
 where id=p_tenant_id;
 if not found then raise exception 'Imobiliaria nao encontrada' using errcode='22023'; end if;
 insert into public.audit_events(actor_id,tenant_id,action,entity_type,entity_id,details)
 values(auth.uid(),p_tenant_id,'tenant.updated','tenant',p_tenant_id::text,'{}');
end;
$$;

create or replace function public.admin_update_tenant(
 p_tenant_id uuid,p_name text,p_contact_name text,p_contact_email text,p_contact_phone text
) returns void language sql security invoker set search_path=''
as $$select app_private.admin_update_tenant_impl(p_tenant_id,p_name,p_contact_name,p_contact_email,p_contact_phone)$$;

create or replace function app_private.admin_set_tenant_state_impl(
 p_tenant_id uuid, p_state text
) returns void language plpgsql security definer set search_path=''
as $$
declare v_state text; v_subscription public.subscriptions%rowtype;
begin
 if not app_private.is_platform_admin() then
  raise exception 'Acesso administrativo necessario' using errcode='42501';
 end if;
 if p_state not in ('enabled','disabled') then
  raise exception 'Situacao invalida' using errcode='22023';
 end if;
 select state into v_state from public.tenants where id=p_tenant_id for update;
 if not found then raise exception 'Imobiliaria nao encontrada' using errcode='22023'; end if;
 if v_state=p_state then return; end if;
 update public.tenants set state=p_state,updated_at=now() where id=p_tenant_id;
 select * into v_subscription from public.subscriptions where tenant_id=p_tenant_id for update;
 if not found then raise exception 'Assinatura nao encontrada' using errcode='22023'; end if;
 if p_state='disabled' then
  update public.subscriptions set status='suspended',updated_at=now()
  where tenant_id=p_tenant_id;
 else
  update public.subscriptions
  set status=(case
    when v_subscription.paid_until is not null and v_subscription.paid_until>=current_date then 'active'
    when v_subscription.trial_ends_at>now() then 'trial'
    else 'past_due'
  end),updated_at=now()
  where tenant_id=p_tenant_id;
 end if;
 insert into public.audit_events(actor_id,tenant_id,action,entity_type,entity_id,details)
 values(auth.uid(),p_tenant_id,
  case when p_state='disabled' then 'tenant.suspended' else 'tenant.reactivated' end,
  'tenant',p_tenant_id::text,jsonb_build_object('previous_state',v_state,'new_state',p_state));
end;
$$;
create or replace function public.admin_set_tenant_state(p_tenant_id uuid,p_state text)
returns void language sql security invoker set search_path=''
as $$select app_private.admin_set_tenant_state_impl(p_tenant_id,p_state)$$;

-- Cancelar execucao anonima; deixar apenas usuarios autenticados,
-- e verificar explicitamente se o solicitante e admin dentro de cada operacao.
revoke all on function app_private.admin_create_plan_impl(text,integer) from public,anon;
revoke all on function app_private.admin_create_tenant_impl(text,text,text,text,text,uuid) from public,anon;
revoke all on function app_private.admin_update_tenant_impl(uuid,text,text,text,text) from public,anon;
revoke all on function app_private.admin_set_tenant_state_impl(uuid,text) from public,anon;
grant execute on function app_private.admin_create_plan_impl(text,integer) to authenticated;
grant execute on function app_private.admin_create_tenant_impl(text,text,text,text,text,uuid) to authenticated;
grant execute on function app_private.admin_update_tenant_impl(uuid,text,text,text,text) to authenticated;
grant execute on function app_private.admin_set_tenant_state_impl(uuid,text) to authenticated;
revoke all on function public.admin_create_plan(text,integer) from public,anon;
revoke all on function public.admin_create_tenant(text,text,text,text,text,uuid) from public,anon;
revoke all on function public.admin_update_tenant(uuid,text,text,text,text) from public,anon;
revoke all on function public.admin_set_tenant_state(uuid,text) from public,anon;
grant execute on function public.admin_create_plan(text,integer) to authenticated;
grant execute on function public.admin_create_tenant(text,text,text,text,text,uuid) to authenticated;
grant execute on function public.admin_update_tenant(uuid,text,text,text,text) to authenticated;
grant execute on function public.admin_set_tenant_state(uuid,text) to authenticated;
