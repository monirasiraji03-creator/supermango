create table sm_commerce_preview.messaging_inbox (
 id uuid primary key, channel text not null check(channel in ('messenger','whatsapp')),
 origin text not null check(origin in ('organic','click_to_message_ad','unknown')),
 intent text not null check(intent in ('product_question','order_request','support')),
 order_id uuid unique references sm_commerce_preview.orders(id),
 created_by uuid not null, created_at timestamptz not null default now(),
 linked_at timestamptz, test_only boolean not null default true check(test_only),
 check((order_id is null)=(linked_at is null))
);
alter table sm_commerce_preview.messaging_inbox enable row level security;
revoke all on sm_commerce_preview.messaging_inbox from public,anon,authenticated,service_role;
create function sm_commerce_preview.messaging_lab(op text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare a uuid:=auth.uid(); k uuid; oid uuid; r sm_commerce_preview.messaging_inbox%rowtype; c text; o text; i text; oc text;
begin
 if a is null or not sm_private.is_admin() then raise exception 'NOT_AUTHORIZED' using errcode='42501'; end if;
 if payload is null or jsonb_typeof(payload)<>'object' or length(payload::text)>500 then raise exception 'INVALID_PAYLOAD'; end if;
 if op='list' then
 if payload<>'{}'::jsonb then raise exception 'INVALID_PAYLOAD'; end if;
 return jsonb_build_object('test_only',true,'outbound_enabled',false,'inbox',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select id,channel,origin,intent,order_id,created_at,linked_at from sm_commerce_preview.messaging_inbox order by created_at desc limit 100)x),'[]'::jsonb),'orders',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,channel,state,variety,kg from sm_commerce_preview.orders where channel in ('messenger','whatsapp') and state<>'cancelled' order by created_at desc limit 100)x),'[]'::jsonb)); end if;
 if op='capture' then
 if payload- array['id','channel','origin','intent'] <> '{}'::jsonb then raise exception 'INVALID_PAYLOAD'; end if;
 k:=(payload->>'id')::uuid;c:=payload->>'channel';o:=payload->>'origin';i:=payload->>'intent';
 if k is null or c is null or c not in ('messenger','whatsapp') or o is null or o not in ('organic','click_to_message_ad','unknown') or i is null or i not in ('product_question','order_request','support') then raise exception 'INVALID_FIXTURE'; end if;
 insert into sm_commerce_preview.messaging_inbox(id,channel,origin,intent,created_by) values(k,c,o,i,a) on conflict(id) do nothing;
 select * into r from sm_commerce_preview.messaging_inbox where id=k;
 if r.channel is distinct from c or r.origin is distinct from o or r.intent is distinct from i then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 return jsonb_build_object('id',r.id,'test_only',true,'outbound_enabled',false);
 elsif op='link' then
 if payload- array['id','order_id'] <> '{}'::jsonb then raise exception 'INVALID_PAYLOAD';end if;
 k:=(payload->>'id')::uuid;oid:=(payload->>'order_id')::uuid;
 select * into r from sm_commerce_preview.messaging_inbox where id=k for update;
 if not found or r.intent<>'order_request' then raise exception 'ORDER_REQUEST_REQUIRED';end if;
 if r.order_id is not null then if r.order_id=oid then return jsonb_build_object('id',k,'order_id',oid,'test_only',true);end if;raise exception 'LINK_IMMUTABLE';end if;
 select channel into oc from sm_commerce_preview.orders where id=oid and state<>'cancelled' for update;
 if not found or oc is distinct from r.channel then raise exception 'CHANNEL_MISMATCH_OR_ORDER_UNAVAILABLE';end if;
 if exists(select 1 from sm_commerce_preview.messaging_inbox where order_id=oid) then raise exception 'ORDER_ALREADY_LINKED';end if;
 update sm_commerce_preview.messaging_inbox set order_id=oid,linked_at=now() where id=k;
 return jsonb_build_object('id',k,'order_id',oid,'test_only',true,'outbound_enabled',false);
 end if; raise exception 'INVALID_OPERATION';
end $fn$;
revoke all on function sm_commerce_preview.messaging_lab(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function sm_commerce_preview.messaging_lab(text,jsonb) to authenticated;
create function public.sm_preview_messaging(op text,payload jsonb) returns jsonb language sql security invoker set search_path='' as $fn$select sm_commerce_preview.messaging_lab(op,payload)$fn$;
revoke all on function public.sm_preview_messaging(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.sm_preview_messaging(text,jsonb) to authenticated;
comment on table sm_commerce_preview.messaging_inbox is 'Synthetic attribution fixtures only; not actual conversations or provider-verified attribution; no outbound transport.';
notify pgrst,'reload schema';
