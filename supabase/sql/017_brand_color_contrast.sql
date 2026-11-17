-- 017: contraste mínimo WCAG 4.5:1 com texto branco sobre a cor principal.
create or replace function app_private.white_text_contrast_ok(p_color text)
returns boolean language plpgsql immutable set search_path=''
as $$
declare r double precision;g double precision;b double precision;lum double precision;v text;
begin
 if p_color is null or p_color !~ '^#[0-9A-Fa-f]{6}$' then return false;end if;
 v=substring(p_color from 2);
 r=get_byte(decode(v,'hex'),0)/255.0;
 g=get_byte(decode(v,'hex'),1)/255.0;
 b=get_byte(decode(v,'hex'),2)/255.0;
 r=case when r<=0.04045 then r/12.92 else power((r+0.055)/1.055,2.4) end;
 g=case when g<=0.04045 then g/12.92 else power((g+0.055)/1.055,2.4) end;
 b=case when b<=0.04045 then b/12.92 else power((b+0.055)/1.055,2.4) end;
 lum=0.2126*r+0.7152*g+0.0722*b;
 return (1.05/(lum+0.05))>=4.5;
end;$$;
alter table public.tenant_websites add constraint site_primary_color_white_contrast
 check(app_private.white_text_contrast_ok(primary_color));
