create table sm_commerce_preview.meta_diagnostic_pairs (
 pair_id text primary key check (pair_id ~ '^sm-pair-[a-f0-9]{32}$'),
 reserved_by uuid not null, browser_reserved_at timestamptz not null default now(),
 server_reserved_at timestamptz, check(server_reserved_at is null or server_reserved_at>=browser_reserved_at)
);
alter table sm_commerce_preview.meta_diagnostic_pairs enable row level security;
revoke all on sm_commerce_preview.meta_diagnostic_pairs from public,anon,authenticated,service_role;
create function sm_commerce_preview.claim_meta_pair(p_pair_id text,p_stage text) returns text
language plpgsql security definer set search_path='' as $fn$
declare n integer;
begin
 if auth.uid() is null or not sm_private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_pair_id is null or p_pair_id !~ '^sm-pair-[a-f0-9]{32}$' or p_stage is null or p_stage not in ('browser','server') then raise exception 'INVALID_PAIR' using errcode='22023'; end if;
 if p_stage='browser' then
  insert into sm_commerce_preview.meta_diagnostic_pairs(pair_id,reserved_by) values(p_pair_id,auth.uid()) on conflict do nothing;
  get diagnostics n=row_count;
  if n=1 then return 'reserved'; end if;
  return 'duplicate';
 end if;
 update sm_commerce_preview.meta_diagnostic_pairs set server_reserved_at=clock_timestamp()
 where pair_id=p_pair_id and reserved_by=auth.uid() and server_reserved_at is null and browser_reserved_at>now()-interval '15 minutes';
 get diagnostics n=row_count;
 if n=1 then return 'reserved'; end if;
 if exists(select 1 from sm_commerce_preview.meta_diagnostic_pairs where pair_id=p_pair_id and reserved_by=auth.uid() and server_reserved_at is not null) then return 'duplicate'; end if;
 return 'missing_or_expired';
end;
$fn$;
revoke all on function sm_commerce_preview.claim_meta_pair(text,text) from public,anon,authenticated,service_role;
grant execute on function sm_commerce_preview.claim_meta_pair(text,text) to authenticated;
create function public.sm_meta_claim_pair(p_pair_id text,p_stage text) returns text language sql security invoker set search_path='' as $fn$select sm_commerce_preview.claim_meta_pair(p_pair_id,p_stage)$fn$;
revoke all on function public.sm_meta_claim_pair(text,text) from public,anon,authenticated,service_role;
grant execute on function public.sm_meta_claim_pair(text,text) to authenticated;
comment on table sm_commerce_preview.meta_diagnostic_pairs is 'Preview only, one browser authorization and server attempt per pair. No retry or release; claim is not provider receipt.';
notify pgrst,'reload schema';
