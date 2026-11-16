-- 008: gerar no banco as proximas 12 mensalidades quando contrato inicia
create or replace function app_private.schedule_rent_charges()
returns trigger language plpgsql security definer set search_path=''
as $$
declare i integer; v_month date; v_due date; v_max_month date;
begin
 if new.status='active' and (tg_op='INSERT' or old.status is distinct from 'active') then
  v_max_month=date_trunc('month',new.end_on)::date;
  for i in 0..11 loop
   v_month=(date_trunc('month',new.start_on)::date + make_interval(months=>i))::date;
   exit when v_month>v_max_month;
   v_due=make_date(extract(year from v_month)::int,extract(month from v_month)::int,new.due_day);
   if v_due >= new.start_on and v_due <= new.end_on then
    insert into public.rent_charges(tenant_id,contract_id,due_on,amount_cents,created_by)
    values(new.tenant_id,new.id,v_due,new.monthly_rent_cents,new.created_by)
    on conflict(tenant_id,contract_id,due_on) do nothing;
   end if;
  end loop;
 end if;
 return new;
end;$$;
create trigger contract_payment_schedule after insert or update of status on public.rental_contracts
for each row execute function app_private.schedule_rent_charges();
