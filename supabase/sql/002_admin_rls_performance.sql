-- VILLE Imobiliario | Refinamento de politicas e indices | Versao 002
-- Remover politicas FOR ALL que duplicavam SELECT e restringir escrita a cada operacao.
drop policy if exists tenant_members_admin_write on public.tenant_members;
drop policy if exists tenants_admin_write on public.tenants;
drop policy if exists plans_admin_write on public.subscription_plans;
drop policy if exists subscriptions_admin_write on public.subscriptions;
drop policy if exists invoices_admin_write on public.invoices;
drop policy if exists payments_admin_write on public.payments;

create policy tenant_members_admin_insert on public.tenant_members
  for insert to authenticated with check ((select app_private.is_platform_admin()));
create policy tenant_members_admin_update on public.tenant_members
  for update to authenticated
  using ((select app_private.is_platform_admin()))
  with check ((select app_private.is_platform_admin()));
create policy tenant_members_admin_delete on public.tenant_members
  for delete to authenticated using ((select app_private.is_platform_admin()));

create policy tenants_admin_insert on public.tenants
  for insert to authenticated with check ((select app_private.is_platform_admin()));
create policy tenants_admin_update on public.tenants
  for update to authenticated
  using ((select app_private.is_platform_admin()))
  with check ((select app_private.is_platform_admin()));
create policy tenants_admin_delete on public.tenants
  for delete to authenticated using ((select app_private.is_platform_admin()));

create policy plans_admin_insert on public.subscription_plans
  for insert to authenticated with check ((select app_private.is_platform_admin()));
create policy plans_admin_update on public.subscription_plans
  for update to authenticated
  using ((select app_private.is_platform_admin()))
  with check ((select app_private.is_platform_admin()));
create policy plans_admin_delete on public.subscription_plans
  for delete to authenticated using ((select app_private.is_platform_admin()));

create policy subscriptions_admin_insert on public.subscriptions
  for insert to authenticated with check ((select app_private.is_platform_admin()));
create policy subscriptions_admin_update on public.subscriptions
  for update to authenticated
  using ((select app_private.is_platform_admin()))
  with check ((select app_private.is_platform_admin()));
create policy subscriptions_admin_delete on public.subscriptions
  for delete to authenticated using ((select app_private.is_platform_admin()));

create policy invoices_admin_insert on public.invoices
  for insert to authenticated with check ((select app_private.is_platform_admin()));
create policy invoices_admin_update on public.invoices
  for update to authenticated
  using ((select app_private.is_platform_admin()))
  with check ((select app_private.is_platform_admin()));
create policy invoices_admin_delete on public.invoices
  for delete to authenticated using ((select app_private.is_platform_admin()));

create policy payments_admin_insert on public.payments
  for insert to authenticated with check ((select app_private.is_platform_admin()));
create policy payments_admin_update on public.payments
  for update to authenticated
  using ((select app_private.is_platform_admin()))
  with check ((select app_private.is_platform_admin()));
create policy payments_admin_delete on public.payments
  for delete to authenticated using ((select app_private.is_platform_admin()));

create index if not exists payments_invoice_fk_idx on public.payments(invoice_id, tenant_id);
create index if not exists payments_reviewer_fk_idx on public.payments(reviewed_by);
create index if not exists audit_actor_fk_idx on public.audit_events(actor_id);
create index if not exists subscription_plan_fk_idx on public.subscriptions(plan_id);
