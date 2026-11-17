-- 014: impedir publicação direta via API se o site estiver incompleto.
create or replace function app_private.validate_website_publication()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.is_published then
  if char_length(trim(new.site_name))<2 or coalesce(new.logo_path,'')='' or
   coalesce(new.banner_path,'')='' or
   coalesce(new.whatsapp,'') !~ '^[0-9]{10,15}$' or
   not exists(select 1 from public.properties p
      where p.tenant_id=new.tenant_id and p.published=true and p.status='available')
  then
   raise exception 'Antes de publicar, configure nome, logomarca, banner, WhatsApp e ao menos um imóvel disponível'
    using errcode='22023';
  end if;
 end if;
 return new;
end;$$;
drop trigger if exists website_publication_guard on public.tenant_websites;
create trigger website_publication_guard before insert or update on public.tenant_websites
 for each row execute function app_private.validate_website_publication();

-- Bloquear URLs de Instagram com credenciais, parâmetros exagerados ou domínio falso.
alter table public.tenant_websites add constraint website_about_no_control_chars
 check(about_text !~ '[[:cntrl:]]' or position(chr(10) in about_text)>0);
