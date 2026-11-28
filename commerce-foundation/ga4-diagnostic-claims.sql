create table sm_commerce_preview.ga4_diagnostic_claims (
 diagnostic_id text primary key check (diagnostic_id ~ '^sm-ga-[a-f0-9]{32}$'),
 reserved_by uuid not null default auth.uid(),
 reserved_at timestamptz not null default now()
);
alter table sm_commerce_preview.ga4_diagnostic_claims enable row level security;
revoke all on table sm_commerce_preview.ga4_diagnostic_claims from public, anon, authenticated, service_role;
grant insert (diagnostic_id) on sm_commerce_preview.ga4_diagnostic_claims to authenticated;
create policy ga4_claim_admin_insert on sm_commerce_preview.ga4_diagnostic_claims for insert to authenticated
with check (reserved_by=(select auth.uid()) and (select sm_private.is_admin()));
create function public.sm_ga4_reserve_diagnostic(p_diagnostic_id text)
returns boolean language plpgsql security invoker set search_path='' as $fn$
declare n integer;
begin
 if auth.uid() is null or not sm_private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_diagnostic_id is null or p_diagnostic_id !~ '^sm-ga-[a-f0-9]{32}$' then raise exception 'INVALID_DIAGNOSTIC_ID' using errcode='22023'; end if;
 insert into sm_commerce_preview.ga4_diagnostic_claims(diagnostic_id) values (p_diagnostic_id) on conflict do nothing;
 get diagnostics n = row_count;
 return n=1;
end;
$fn$;
revoke all on function public.sm_ga4_reserve_diagnostic(text) from public, anon, authenticated, service_role;
grant execute on function public.sm_ga4_reserve_diagnostic(text) to authenticated;
comment on table sm_commerce_preview.ga4_diagnostic_claims is 'Preview only; immutable at-most-once attempt claims. Never clear on error or timeout. No customer or GA identifiers besides diagnostic ID.';
notify pgrst, 'reload schema';
