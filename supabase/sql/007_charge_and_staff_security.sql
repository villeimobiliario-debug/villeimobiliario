-- 007: protecoes de recebimentos e gestao segura de equipe
create or replace function app_private.protect_paid_charge()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.id is distinct from old.id or new.tenant_id is distinct from old.tenant_id
  or new.contract_id is distinct from old.contract_id or new.created_by is distinct from old.created_by
  or new.created_at is distinct from old.created_at then
    raise exception 'A identidade da cobranca nao pode ser alterada' using errcode='42501';
 end if;
 if old.status='paid' and
  (new.status is distinct from old.status or new.amount_cents is distinct from old.amount_cents
   or new.due_on is distinct from old.due_on or new.paid_on is distinct from old.paid_on) then
    raise exception 'Cobranca recebida nao pode ser alterada; solicite um estorno auditado' using errcode='42501';
 end if;
 if exists (select 1 from public.owner_payouts where tenant_id=old.tenant_id and charge_id=old.id)
    and new.amount_cents is distinct from old.amount_cents then
    raise exception 'Valor com repasse ja calculado nao pode ser alterado' using errcode='42501';
 end if;
 new.updated_at=now();
 return new;
end;$$;
drop trigger if exists rent_charges_lock on public.rent_charges;
create trigger rent_charges_lock before update on public.rent_charges
 for each row execute function app_private.protect_paid_charge();

-- A equipe so pode ser vinculada a contas com email ja confirmado.
-- Nao inventa senhas nem cria contas em nome de terceiros.
create or replace function public.agency_staff_list(p_tenant_id uuid)
returns table(user_id uuid,email text,role text,created_at timestamptz)
language plpgsql security definer set search_path=''
as $$
begin
 if not app_private.tenant_can_manage(p_tenant_id) then
  raise exception 'Acesso de gestor necessario' using errcode='42501';
 end if;
 return query
 select m.user_id,u.email::text,m.role,m.created_at
 from public.tenant_members m join auth.users u on u.id=m.user_id
 where m.tenant_id=p_tenant_id order by m.created_at;
end;$$;
revoke all on function public.agency_staff_list(uuid) from public,anon;
grant execute on function public.agency_staff_list(uuid) to authenticated;

create or replace function public.agency_assign_staff(p_tenant_id uuid,p_email text,p_role text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_target uuid;v_member text;
begin
 if not app_private.tenant_can_use(p_tenant_id) then
  raise exception 'Imobiliaria sem acesso ativo' using errcode='42501';
 end if;
 if not exists(select 1 from public.tenant_members where tenant_id=p_tenant_id
                 and user_id=auth.uid() and role='owner') then
  raise exception 'Somente o proprietario pode administrar a equipe' using errcode='42501';
 end if;
 if p_role not in ('manager','agent') then
  raise exception 'Permissao de equipe invalida' using errcode='22023';
 end if;
 select u.id into v_target from auth.users u
 where lower(u.email)=lower(trim(p_email)) and u.email_confirmed_at is not null
    and u.deleted_at is null;
 if v_target is null then
  raise exception 'Esta pessoa precisa criar e confirmar seu acesso antes de ser vinculada' using errcode='22023';
 end if;
 select m.role into v_member from public.tenant_members m
  where m.tenant_id=p_tenant_id and m.user_id=v_target for update;
 if v_member='owner' then
  raise exception 'Nao e permitido alterar o proprietario' using errcode='42501';
 end if;
 insert into public.tenant_members(tenant_id,user_id,role)
 values(p_tenant_id,v_target,p_role)
 on conflict(tenant_id,user_id) do update set role=excluded.role;
 insert into public.audit_events(actor_id,tenant_id,action,entity_type,entity_id,details)
 values(auth.uid(),p_tenant_id,'agency.staff_assigned','user',v_target::text,
   jsonb_build_object('role',p_role));
 return v_target;
end;$$;
revoke all on function public.agency_assign_staff(uuid,text,text) from public,anon;
grant execute on function public.agency_assign_staff(uuid,text,text) to authenticated;

create or replace function public.agency_remove_staff(p_tenant_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_role text;
begin
 if not app_private.tenant_can_use(p_tenant_id)
  or not exists(select 1 from public.tenant_members where tenant_id=p_tenant_id
        and user_id=auth.uid() and role='owner') then
  raise exception 'Somente o proprietario pode remover membros' using errcode='42501';
 end if;
 select role into v_role from public.tenant_members
  where tenant_id=p_tenant_id and user_id=p_user_id for update;
 if v_role is null then raise exception 'Membro nao encontrado' using errcode='22023';end if;
 if v_role='owner' then raise exception 'O proprietario nao pode ser removido' using errcode='42501';end if;
 delete from public.tenant_members where tenant_id=p_tenant_id and user_id=p_user_id;
 insert into public.audit_events(actor_id,tenant_id,action,entity_type,entity_id,details)
 values(auth.uid(),p_tenant_id,'agency.staff_removed','user',p_user_id::text,
   jsonb_build_object('role',v_role));
end;$$;
revoke all on function public.agency_remove_staff(uuid,uuid) from public,anon;
grant execute on function public.agency_remove_staff(uuid,uuid) to authenticated;
