-- VILLE Imobiliário | Bootstrap seguro do primeiro administrador
-- Nenhuma senha é armazenada aqui. Supabase Auth confirma a posse do e-mail.
-- Apenas a conta do e-mail autorizado e confirmado recebe privilégios.
create or replace function app_private.sync_initial_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(new.email) = 'villeimobiliario@gmail.com'
     and new.email_confirmed_at is not null
     and new.deleted_at is null then
    insert into app_private.platform_admins (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  else
    delete from app_private.platform_admins where user_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function app_private.sync_initial_admin() from public, anon, authenticated;

create trigger sync_initial_admin_auth
after insert or update of email, email_confirmed_at, deleted_at
on auth.users
for each row execute function app_private.sync_initial_admin();

-- Não remove nenhum admin nem altera usuários. Apenas reconcilia a conta permitida
-- caso já esteja cadastrada e confirmada antes da criação do gatilho.
insert into app_private.platform_admins (user_id)
select id from auth.users
where lower(email) = 'villeimobiliario@gmail.com'
  and email_confirmed_at is not null
  and deleted_at is null
on conflict (user_id) do nothing;
